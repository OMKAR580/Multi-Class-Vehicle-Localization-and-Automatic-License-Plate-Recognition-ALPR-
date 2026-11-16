import { NextRequest, NextResponse } from 'next/server';

function generateJWT(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  authProvider: string;
  isGuest?: boolean;
}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.authProvider,
      isGuest: Boolean(user.isGuest),
      iat: Math.floor(Date.now() / 1000),
      exp,
    })
  ).toString('base64');
  const signature = Buffer.from(`vp_sig_${user.id}_${exp}`).toString('base64');
  return `${header}.${payload}.${signature}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  const origin = request.nextUrl.origin;

  if (error) {
    const errorMsg = errorDesc || error || 'Google authorization was cancelled or denied.';
    return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(errorMsg)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/app/login?error=Google+authorization+code+was+not+provided', origin));
  }

  try {
    const clientId =
      process.env.GOOGLE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      '666838598365-q60r1qd4orli5qfr57j7l6kgohj7k80l.apps.googleusercontent.com';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Canonicalize any *.vercel.app preview or branch domains to the registered production domain
    const effectiveOrigin = origin.includes('.vercel.app')
      ? 'https://multi-class-vehicle-localization-an-beta.vercel.app'
      : origin;
    const redirectUri = `${effectiveOrigin}/api/auth/callback/google`;

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.');
    }

    // Exchange authorization code with Google for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      const msg =
        tokenData.error_description ||
        tokenData.error ||
        `Google token exchange failed (${tokenResponse.status})`;
      console.error('[Google OAuth Token Exchange Error]:', tokenData);
      return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(msg)}`, origin));
    }

    // Retrieve verified Google User profile
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    if (!userData || !userData.email) {
      throw new Error('Unable to retrieve verified email from Google.');
    }

    // Synchronize with FastAPI backend and Supabase PostgreSQL
    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      (process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace('localhost', '127.0.0.1')
        : 'http://127.0.0.1:8000/api/v1');
    let syncData: any = null;
    try {
      const syncResp = await fetch(`${backendUrl}/auth/oauth/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          provider_user_id: userData.sub,
          email: userData.email,
          full_name: userData.name || '',
          avatar_url: userData.picture || '',
        }),
      });
      syncData = await syncResp.json();
      if (!syncResp.ok) {
        const msg = syncData.detail || syncData.message || 'Google account synchronization failed.';
        console.error('[Google OAuth Sync Error]:', syncData);
        return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(msg)}`, origin));
      }
    } catch (e: any) {
      console.error('[Google OAuth Backend Unreachable Error]:', e);
      return NextResponse.redirect(
        new URL(`/app/login?error=${encodeURIComponent('Backend authentication service is unreachable. Please ensure the backend is running.')}`, origin)
      );
    }

    // Case A: New user from Google -> Prompt to create Username and Password
    if (syncData.status === 'needs_setup') {
      const setupUrl = new URL('/app/login', origin);
      setupUrl.searchParams.set('oauth_setup', 'true');
      setupUrl.searchParams.set('email', userData.email);
      setupUrl.searchParams.set('name', userData.name || '');
      setupUrl.searchParams.set('provider', 'google');
      setupUrl.searchParams.set('provider_user_id', userData.sub);
      setupUrl.searchParams.set('avatar_url', userData.picture || '');
      return NextResponse.redirect(setupUrl);
    }

    // Case B: Existing user or authenticated -> Real cryptographically signed FastAPI JWT
    const token = syncData.access_token;
    const userProfile = {
      id: syncData.user?.id || `usr_google_${userData.sub}`,
      name: syncData.user?.full_name || userData.name || userData.email.split('@')[0],
      email: syncData.user?.email || userData.email,
      role: (syncData.user?.role || 'operator') as 'operator' | 'admin' | 'guest',
      authProvider: 'google' as const,
      createdAt: syncData.user?.created_at || new Date().toISOString(),
      avatarUrl: syncData.user?.avatar_url || userData.picture || '',
    };

    const session = {
      token,
      user: userProfile,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VisionPlate AI - Google Authorization</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background-color: #0c0d0e;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      text-align: center;
      padding: 36px 28px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      backdrop-filter: blur(16px);
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255, 255, 255, 0.12);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 1.15rem; margin: 0 0 8px; font-weight: 600; }
    p { font-size: 0.85rem; color: rgba(255, 255, 255, 0.65); margin: 0; }
    .badge {
      display: inline-block;
      margin-top: 16px;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 0.75rem;
      border-radius: 9999px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Welcome back, ${escapeHtml(userProfile.name)}!</h2>
    <p>Signed in as <strong>${escapeHtml(userProfile.email)}</strong></p>
    <div class="badge">Google Verified • Redirecting to Studio...</div>
  </div>
  <script>
    try {
      const session = ${JSON.stringify(session)};
      localStorage.setItem('visionplate_auth_session', JSON.stringify(session));
      localStorage.setItem('visionplate_token', session.token);
      localStorage.removeItem('visionplate_guest_accessed');
      document.cookie = 'access_token=' + session.token + '; path=/; max-age=604800; SameSite=Lax';

      const existingUsersRaw = localStorage.getItem('visionplate_users');
      const users = existingUsersRaw ? JSON.parse(existingUsersRaw) : [];
      const userExists = users.some(function(u) { return u.email.toLowerCase() === session.user.email.toLowerCase(); });
      if (!userExists) {
        users.push(session.user);
        localStorage.setItem('visionplate_users', JSON.stringify(users));
      }

      window.dispatchEvent(new Event('visionplate_auth_change'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error(e);
    }
    window.location.replace('/app/dashboard');
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/app/login?error=${encodeURIComponent(err.message || 'Google OAuth failed')}`, origin)
    );
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

