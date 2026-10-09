import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Optional, Tuple
from urllib.parse import urlencode, urlparse

import httpx
from jose import jwt, JWTError

from app.core.config import settings
from app.core.exceptions import (
    OAuthException,
    ProviderAPIException,
    ProviderNotConfiguredException,
)
from app.core.logging import logger


def validate_redirect_url(redirect_url: Optional[str]) -> str:
    """
    Validates optional target redirect URL against settings.ALLOWED_REDIRECT_URLS.
    Enforces strict scheme, host, and path matching to prevent open redirects.
    """
    default_url = (
        settings.ALLOWED_REDIRECT_URLS[0]
        if settings.ALLOWED_REDIRECT_URLS
        else "http://localhost:3000/dashboard"
    )
    if not redirect_url or not redirect_url.strip():
        return default_url

    url_str = redirect_url.strip()
    if url_str.startswith("//") or url_str.startswith("\\\\"):
        raise OAuthException("Requested redirect URL is not allowlisted.")

    try:
        parsed = urlparse(url_str)
    except Exception:
        raise OAuthException("Requested redirect URL is not allowlisted.")

    if not parsed.scheme or not parsed.netloc:
        raise OAuthException("Requested redirect URL is not allowlisted.")

    if parsed.scheme not in ["http", "https"]:
        raise OAuthException("Requested redirect URL is not allowlisted.")

    target_clean = f"{parsed.scheme}://{parsed.netloc.lower()}{parsed.path}"
    for allowed in settings.ALLOWED_REDIRECT_URLS:
        try:
            allowed_parsed = urlparse(allowed.strip())
            allowed_clean = (
                f"{allowed_parsed.scheme}://{allowed_parsed.netloc.lower()}{allowed_parsed.path}"
            )
            if target_clean == allowed_clean or target_clean == allowed_clean.rstrip("/"):
                return url_str
        except Exception:
            continue

    raise OAuthException("Requested redirect URL is not allowlisted.")


class OAuthStateManager:
    """Handles secure, signed, timestamped state & nonce values for CSRF protection."""

    @classmethod
    def create_state(
        cls, provider: str, redirect_url: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Validates redirect_url and creates a state payload and its HMAC-SHA256 signature.
        Returns (raw_state_token, signed_cookie_value).
        """
        validated_redirect = validate_redirect_url(redirect_url)
        rand_token = secrets.token_urlsafe(32)
        exp = int(time.time()) + 600  # 10 minutes valid
        payload = {
            "p": provider,
            "r": rand_token,
            "exp": exp,
            "u": validated_redirect,
        }
        encoded_payload = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )
        return rand_token, encoded_payload

    @classmethod
    def verify_state(
        cls, state_param: str, cookie_state: str, expected_provider: str
    ) -> str:
        """
        Verifies that state parameter matches signed cookie state.
        Returns validated target redirect_url.
        """
        if not state_param or not cookie_state:
            raise OAuthException("Missing OAuth state parameter or state cookie")

        try:
            payload = jwt.decode(
                cookie_state, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
            )
        except JWTError:
            raise OAuthException("Invalid OAuth state token")

        if payload.get("exp", 0) < int(time.time()):
            raise OAuthException("OAuth state has expired. Please try logging in again.")

        if payload.get("p") != expected_provider:
            raise OAuthException("OAuth state provider mismatch")

        if state_param != payload.get("r") and state_param != cookie_state:
            raise OAuthException("OAuth state verification failed (CSRF mismatch)")

        return validate_redirect_url(payload.get("u"))

    @classmethod
    def create_nonce(cls) -> Tuple[str, str]:
        """Generates a random nonce and signed token for Google OIDC."""
        nonce = secrets.token_urlsafe(32)
        exp = int(time.time()) + 600
        payload = {"nonce": nonce, "exp": exp}
        signed_nonce = jwt.encode(
            payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )
        return nonce, signed_nonce

    @classmethod
    def verify_nonce(cls, expected_nonce: str, signed_nonce_cookie: str) -> None:
        if not expected_nonce or not signed_nonce_cookie:
            raise OAuthException("Missing OIDC nonce parameter or cookie")
        try:
            payload = jwt.decode(
                signed_nonce_cookie,
                settings.SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
        except JWTError:
            raise OAuthException("Invalid OIDC nonce token")

        if payload.get("exp", 0) < int(time.time()):
            raise OAuthException("OIDC nonce has expired")

        if payload.get("nonce") != expected_nonce:
            raise OAuthException("OIDC nonce verification failed")


class GoogleOAuthProvider:
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

    jwks_override: Optional[dict[str, Any]] = None
    _jwks_cache: Optional[dict[str, Any]] = None
    _jwks_cache_time: float = 0.0

    @classmethod
    def check_configured(cls) -> None:
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise ProviderNotConfiguredException("google")

    @classmethod
    def get_authorization_url(cls, state: str, nonce: str) -> str:
        cls.check_configured()
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"{cls.AUTH_URL}?{urlencode(params)}"

    @classmethod
    async def get_jwks(cls, force_refresh: bool = False) -> dict[str, Any]:
        if cls.jwks_override is not None:
            return cls.jwks_override

        now = time.time()
        if not force_refresh and cls._jwks_cache and (now - cls._jwks_cache_time < 3600):
            return cls._jwks_cache

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(cls.JWKS_URL)
            if resp.status_code != 200:
                raise ProviderAPIException("Google JWKS", f"Failed to fetch public keys ({resp.status_code})")
            cls._jwks_cache = resp.json()
            cls._jwks_cache_time = now
            return cls._jwks_cache

    @classmethod
    async def exchange_code(
        cls, code: str, expected_nonce: Optional[str] = None
    ) -> dict[str, Any]:
        cls.check_configured()
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(cls.TOKEN_URL, data=data)

        if response.status_code != 200:
            logger.error("Google token exchange error status code: %d", response.status_code)
            raise ProviderAPIException("Google", f"Token exchange failed ({response.status_code})")

        token_data = response.json()
        id_token = token_data.get("id_token")
        if not id_token:
            raise OAuthException("Google response did not include id_token")

        try:
            unverified_header = jwt.get_unverified_header(id_token)
        except JWTError as e:
            raise OAuthException(f"Malformed Google ID token header: {str(e)}")

        alg = unverified_header.get("alg")
        if alg != "RS256":
            raise OAuthException(f"Unsupported Google ID token signing algorithm: {alg}")

        kid = unverified_header.get("kid")
        if not kid:
            raise OAuthException("Google ID token header missing key ID (kid)")

        jwks = await cls.get_jwks(force_refresh=False)
        keys = jwks.get("keys", [])
        matching_key = next((k for k in keys if k.get("kid") == kid), None)

        if not matching_key:
            jwks = await cls.get_jwks(force_refresh=True)
            keys = jwks.get("keys", [])
            matching_key = next((k for k in keys if k.get("kid") == kid), None)

        if not matching_key:
            raise OAuthException("Google ID token signing key ID (kid) not found in trusted JWKS")

        try:
            claims = jwt.decode(
                id_token,
                matching_key,
                algorithms=["RS256"],
                audience=settings.GOOGLE_CLIENT_ID,
                options={"verify_aud": True, "verify_iss": False, "verify_exp": True},
            )
        except JWTError as e:
            raise OAuthException(f"Google ID token signature or claim validation failed: {str(e)}")

        iss = claims.get("iss")
        if iss not in ["https://accounts.google.com", "accounts.google.com"]:
            raise OAuthException(f"Invalid Google ID token issuer: {iss}")

        if expected_nonce and claims.get("nonce") != expected_nonce:
            raise OAuthException("Google ID token nonce mismatch")

        email = claims.get("email")
        if not email:
            raise OAuthException("Google user profile did not provide an email address")

        email_verified = claims.get("email_verified", False)
        if not email_verified:
            raise OAuthException("Google email address is not verified")

        sub = claims.get("sub")
        if not sub:
            raise OAuthException("Google ID token missing subject (sub) claim")

        return {
            "provider_user_id": str(sub),
            "email": email.lower().strip(),
            "full_name": claims.get("name"),
            "avatar_url": claims.get("picture"),
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
        }


class GitHubOAuthProvider:
    AUTH_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USER_URL = "https://api.github.com/user"
    EMAILS_URL = "https://api.github.com/user/emails"

    @classmethod
    def check_configured(cls) -> None:
        if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
            raise ProviderNotConfiguredException("github")

    @classmethod
    def get_authorization_url(cls, state: str) -> str:
        cls.check_configured()
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
            "scope": "read:user user:email",
            "state": state,
        }
        return f"{cls.AUTH_URL}?{urlencode(params)}"

    @classmethod
    async def exchange_code(cls, code: str) -> dict[str, Any]:
        cls.check_configured()
        data = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
        }
        headers = {"Accept": "application/json"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(cls.TOKEN_URL, data=data, headers=headers)

            if token_resp.status_code != 200:
                logger.error("GitHub token exchange status code: %d", token_resp.status_code)
                raise ProviderAPIException(
                    "GitHub", f"Token exchange failed ({token_resp.status_code})"
                )

            token_data = token_resp.json()
            if "error" in token_data:
                err_desc = token_data.get("error_description", token_data["error"])
                raise OAuthException(f"GitHub OAuth error: {err_desc}")

            access_token = token_data.get("access_token")
            if not access_token:
                raise OAuthException("GitHub response missing access_token")

            auth_headers = {
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
                "User-Agent": "VisionPlate-AI-Backend",
            }

            user_resp = await client.get(cls.USER_URL, headers=auth_headers)
            if user_resp.status_code != 200:
                raise ProviderAPIException(
                    "GitHub", f"User profile fetch failed ({user_resp.status_code})"
                )
            user_data = user_resp.json()

            emails_resp = await client.get(cls.EMAILS_URL, headers=auth_headers)
            verified_primary_email = None

            if emails_resp.status_code == 200:
                emails_list = emails_resp.json()
                for e in emails_list:
                    if e.get("primary") and e.get("verified"):
                        verified_primary_email = e.get("email")
                        break
                if not verified_primary_email:
                    for e in emails_list:
                        if e.get("verified"):
                            verified_primary_email = e.get("email")
                            break

            if not verified_primary_email and user_data.get("email"):
                verified_primary_email = user_data.get("email")

            if not verified_primary_email:
                raise OAuthException(
                    "GitHub account must have a verified primary email address"
                )

        return {
            "provider_user_id": str(user_data["id"]),
            "email": verified_primary_email.lower().strip(),
            "full_name": user_data.get("name") or user_data.get("login"),
            "avatar_url": user_data.get("avatar_url"),
            "access_token": access_token,
            "refresh_token": token_data.get("refresh_token"),
        }
