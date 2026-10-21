import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionUser, roleCanWrite, SESSION_COOKIE, type AuthUser } from './session';
import { can, type Permission } from './permissions';

export function isSameOriginRequest(request: Request): { valid: boolean; reason?: string } {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const expectedOrigin = host ? `${proto}://${host}` : new URL(request.url).origin;
  
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedUrl = new URL(expectedOrigin);
      if (originUrl.host === expectedUrl.host || originUrl.host === new URL(request.url).host || originUrl.host.includes('localhost') || originUrl.host.includes('run.app')) {
        return { valid: true };
      }
      if (originUrl.origin === expectedUrl.origin) {
        return { valid: true };
      }
      return { valid: false, reason: `Origin mismatch: ${origin} vs ${expectedOrigin}` };
    } catch (e) {
      return { valid: false, reason: `Invalid origin: ${origin}` };
    }
  }
  
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const expectedUrl = new URL(expectedOrigin);
      if (refererUrl.host === expectedUrl.host || refererUrl.host === new URL(request.url).host || refererUrl.host.includes('localhost') || refererUrl.host.includes('run.app')) {
        return { valid: true };
      }
      if (refererUrl.origin === expectedUrl.origin) {
        return { valid: true };
      }
      return { valid: false, reason: `Referer mismatch: ${referer} vs ${expectedOrigin}` };
    } catch (e) {
      return { valid: false, reason: `Invalid referer: ${referer}` };
    }
  }
  
  return { valid: true };
}

export async function authorizeApi(write = false, permission?: Permission, request?: Request): Promise<{ user: AuthUser } | { response: NextResponse }> {
  if ((write || (request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()))) && request && !isSameOriginRequest(request).valid) return { response: NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 }) };
  const store = await cookies();
  const user = await getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  if (permission ? !(await can(user, permission)) : write && !roleCanWrite(user.role)) return { response: NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 }) };
  return { user };
}
