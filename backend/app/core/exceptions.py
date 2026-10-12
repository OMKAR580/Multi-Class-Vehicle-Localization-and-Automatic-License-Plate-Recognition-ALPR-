from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import logger


class AppException(Exception):
    """Base application exception for handled domain and service errors."""

    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)


class ALPRPlatformException(AppException):
    """Compatibility alias for existing platform exception hierarchy."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "BAD_REQUEST",
    ):
        super().__init__(message=message, code=code, status_code=status_code)


class ResourceNotFoundException(ALPRPlatformException):
    def __init__(self, resource_name: str, identifier: str):
        super().__init__(
            message=f"{resource_name} with identifier '{identifier}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
        )


class InvalidCredentialsException(ALPRPlatformException):
    def __init__(self, message: str = "Invalid authentication credentials."):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
        )


class UnauthorizedException(ALPRPlatformException):
    def __init__(self, message: str = "Could not validate credentials"):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
        )


class OAuthException(ALPRPlatformException):
    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "OAUTH_ERROR",
    ):
        super().__init__(
            message=message,
            status_code=status_code,
            code=code,
        )


class ProviderNotConfiguredException(OAuthException):
    def __init__(self, provider: str):
        super().__init__(
            message=f"OAuth provider '{provider}' is not configured on this server.",
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            code="NOT_IMPLEMENTED",
        )


class ProviderAPIException(OAuthException):
    def __init__(self, provider: str, details: str):
        super().__init__(
            message=f"Error response from {provider}: {details}",
            status_code=status.HTTP_502_BAD_GATEWAY,
            code="BAD_GATEWAY",
        )


class FileUploadException(ALPRPlatformException):
    """Base exception for file upload and storage failures."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "FILE_ERROR",
    ):
        super().__init__(message=message, status_code=status_code, code=code)


class PayloadTooLargeException(FileUploadException):
    """Raised when an uploaded file exceeds the configured maximum size."""

    def __init__(self, message: str = "File size exceeds the allowable limit."):
        super().__init__(
            message=message,
            status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
            code="FILE_TOO_LARGE",
        )


class UnsupportedMediaTypeException(FileUploadException):
    """Raised when an uploaded file has an unsupported format or MIME type."""

    def __init__(self, message: str = "Unsupported media format or type."):
        super().__init__(
            message=message,
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            code="UNSUPPORTED_MEDIA_TYPE",
        )


class InvalidFileException(FileUploadException):
    """Raised when an uploaded file is empty, malformed, or corrupted."""

    def __init__(self, message: str = "Invalid, malformed, or empty file."):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_FILE",
        )


class StorageException(FileUploadException):
    """Raised when an underlying storage write, read, or deletion operation fails."""

    def __init__(
        self,
        message: str = "A storage error occurred while processing the file.",
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="STORAGE_ERROR",
        )


class ModelNotConfiguredException(ALPRPlatformException):
    """Raised when required AI model weights or runtime dependencies are missing."""

    def __init__(self, message: str = "AI model weights or runtime engine not configured on server."):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="MODEL_NOT_CONFIGURED",
        )


class RecognitionException(ALPRPlatformException):
    """Raised when image processing or inference pipeline execution fails."""

    def __init__(
        self,
        message: str = "An error occurred during ALPR recognition inference.",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
    ):
        super().__init__(
            message=message,
            status_code=status_code,
            code="RECOGNITION_ERROR",
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    logger.warning("Handled %s on %s: %s", exc.code, request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": exc.code, "message": exc.message},
            "detail": exc.message,
            "status_code": exc.status_code,
        },
    )


# Alias for backward compatibility
alpr_exception_handler = app_exception_handler


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        503: "SERVICE_UNAVAILABLE",
    }
    code = code_map.get(exc.status_code, f"HTTP_{exc.status_code}")
    message = str(exc.detail) if isinstance(exc.detail, str) else "HTTP error"
    logger.warning("HTTP %d on %s: %s", exc.status_code, request.url.path, message)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": code, "message": message},
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = jsonable_encoder(exc.errors())
    logger.warning("Validation error on %s: %s", request.url.path, errors)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
            },
            "detail": errors,
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
        },
    )


async def global_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred.",
            },
            "detail": "An internal server error occurred.",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
        },
    )
