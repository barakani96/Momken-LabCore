import { NextRequest, NextResponse } from 'next/server';
const publicPaths = ['/login', '/forgot-password', '/reset-password', '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/password/forgot', '/api/auth/password/reset', '/api/barcode', '/portal', '/api/portal/reports'];
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.some(item => path === item || path.startsWith(`${item}/`)) || path.startsWith('/_next/') || path === '/favicon.ico') return NextResponse.next();
  if (!request.cookies.has('northstar_session')) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const login = new URL('/login', request.url); login.searchParams.set('next', path); return NextResponse.redirect(login);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!.*\\..*).*)', '/api/:path*'] };
