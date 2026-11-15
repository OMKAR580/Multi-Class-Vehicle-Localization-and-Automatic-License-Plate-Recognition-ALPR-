import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAppRoute = pathname.startsWith('/app');
  const isLoginPage = pathname === '/app/login';
  const token = request.cookies.get('access_token')?.value;

  // If already authenticated with cookie and accessing login, redirect to dashboard
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  // If accessing dashboard routes without cookie, redirect to login
  if (isAppRoute && !isLoginPage && !token) {
    const loginUrl = new URL('/app/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};

