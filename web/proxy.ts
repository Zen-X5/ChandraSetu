import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/utils/session.utils';

export function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const requestHeaders = new Headers(request.headers);
  if (sessionToken && !requestHeaders.has('authorization')) {
    requestHeaders.set('authorization', `Bearer ${sessionToken}`);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    },
  });

  return response;
}

export default proxy;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
