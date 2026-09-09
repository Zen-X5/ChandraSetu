import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/utils/session.utils';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isAuthRoute = pathname.startsWith('/auth/login') || pathname === '/';

  if (isDashboardRoute && !sessionToken) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionToken) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  const requestHeaders = new Headers(request.headers);
  if (sessionToken && !requestHeaders.has('authorization')) {
    requestHeaders.set('authorization', `Bearer ${sessionToken}`);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export default proxy;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|api).*)'],
};
