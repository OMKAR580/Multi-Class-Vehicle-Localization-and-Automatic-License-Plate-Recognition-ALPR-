import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = request.nextUrl.origin;

  // Check if state or params indicate provider
  const state = searchParams.get('state') || '';
  const isGoogle = searchParams.has('scope') && searchParams.get('scope')?.includes('google') || state.includes('google');
  const isGitHub = state.includes('github') || !isGoogle;

  const target = isGoogle ? '/api/auth/callback/google' : '/api/auth/callback/github';
  const redirectUrl = new URL(target, origin);
  searchParams.forEach((val, key) => {
    redirectUrl.searchParams.set(key, val);
  });

  return NextResponse.redirect(redirectUrl);
}

