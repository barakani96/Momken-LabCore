import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionUser, roleCanWrite, SESSION_COOKIE, type AuthUser } from './session';
import { can, type Permission } from './permissions';

export function isSameOriginRequest(request: Request): boolean {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin) { try { return new URL(origin).origin === expected; } catch { return false; } }
  const referer = request.headers.get('referer');
  if (referer) { try { return new URL(referer).origin === expected; } catch { return false; } }
  return process.env.NODE_ENV !== 'production';
}

export async function authorizeApi(write = false, permission?: Permission, request?: Request): Promise<{ user: AuthUser } | { response: NextResponse }> {
  if ((write || (request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()))) && request && !isSameOriginRequest(request)) return { response: NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 }) };
  const store = await cookies();
  const user = await getSessionUser(store.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  if (permission ? !(await can(user, permission)) : write && !roleCanWrite(user.role)) return { response: NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 }) };
  return { user };
}
