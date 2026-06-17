import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auth + admin-role checks happen client-side via the (admin) layout,
 * since Firebase Auth state lives in IndexedDB, not cookies.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
