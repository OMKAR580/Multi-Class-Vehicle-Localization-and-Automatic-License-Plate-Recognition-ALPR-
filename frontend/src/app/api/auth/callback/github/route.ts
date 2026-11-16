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
    const errorMsg = errorDesc || error || 'GitHub authorization was cancelled or denied.';
    return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(errorMsg)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/app/login?error=GitHub+authorization+code+was+not+provided', origin));
  }

  try {
    const clientId =
      process.env.GITHUB_CLIENT_ID ||
      process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ||
      'Ov23liBKszjLELwW0wj6';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    // Canonicalize any *.vercel.app preview or branch domains to the registered production domain
    const effectiveOrigin = origin.includes('.vercel.app')
      ? 'https://multi-class-vehicle-localization-an-beta.vercel.app'
      : origin;
    const redirectUri = `${effectiveOrigin}/api/auth/callback/github`;

    if (!clientId || !clientSecret) {
      throw new Error('GitHub OAuth credentials not configured. Please check GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.local.');
    }

    // Exchange authorization code with GitHub for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      const msg =
        tokenData.error_description ||
        tokenData.error ||
        `GitHub token exchange failed (${tokenResponse.status})`;
      console.error('[GitHub OAuth Token Exchange Error]:', tokenData);
      return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(msg)}`, origin));
    }

    // Retrieve GitHub user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'VisionPlate-AI',
      },
    });

    const userData = await userResponse.json();

    let email = userData.email;
    if (!email) {
      // Query /user/emails in case email is set to private in GitHub
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'VisionPlate-AI',
        },
      });
      const emailsData = await emailsResponse.json();
      if (Array.isArray(emailsData)) {
        const primary = emailsData.find((e: any) => e.primary && e.verified) || emailsData[0];
        if (primary && primary.email) {
          email = primary.email;
        }
      }
    }

    if (!email) {
      email = `${userData.login || 'user'}@users.noreply.github.com`;
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
          provider: 'github',
          provider_user_id: String(userData.id),
          email: email,
          full_name: userData.name || userData.login || '',
          avatar_url: userData.avatar_url || '',
        }),
      });
      syncData = await syncResp.json();
      if (!syncResp.ok) {
        const msg = syncData.detail || syncData.message || 'GitHub account synchronization failed.';
        console.error('[GitHub OAuth Sync Error]:', syncData);
        return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(msg)}`, origin));
      }
    } catch (e: any) {
      console.error('[GitHub OAuth Backend Unreachable Error]:', e);
      return NextResponse.redirect(
        new URL(`/app/login?error=${encodeURIComponent('Backend authentication service is unreachable. Please ensure the backend is running.')}`, origin)
      );
    }

    // Case A: New user from GitHub -> Prompt to create Username and Password
    if (syncData.status === 'needs_setup') {
      const setupUrl = new URL('/app/login', origin);
      setupUrl.searchParams.set('oauth_setup', 'true');
      setupUrl.searchParams.set('email', email);
      setupUrl.searchParams.set('name', userData.name || userData.login || '');
      setupUrl.searchParams.set('provider', 'github');
      setupUrl.searchParams.set('provider_user_id', String(userData.id));
      setupUrl.searchParams.set('avatar_url', userData.avatar_url || '');
      return NextResponse.redirect(setupUrl);
    }

    // Case B: Existing user or authenticated -> Real cryptographically signed FastAPI JWT
    const token = syncData.access_token;
    const userProfile = {
      id: syncData.user?.id || `usr_github_${userData.id}`,
      name: syncData.user?.full_name || userData.name || userData.login || email.split('@')[0],
      email: syncData.user?.email || email,
      role: (syncData.user?.role || 'operator') as 'operator' | 'admin' | 'guest',
      authProvider: 'github' as const,
      createdAt: syncData.user?.created_at || new Date().toISOString(),
      avatarUrl: syncData.user?.avatar_url || userData.avatar_url || '',
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
  <title>VisionPlate AI - GitHub Authorization</title>
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
    <h2>Welcome, @${escapeHtml(userData.login || userProfile.name)}!</h2>
    <p>Signed in as <strong>${escapeHtml(userProfile.email)}</strong></p>
    <div class="badge">GitHub Verified • Redirecting to Studio...</div>
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
      new URL(`/app/login?error=${encodeURIComponent(err.message || 'GitHub OAuth failed')}`, origin)
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

