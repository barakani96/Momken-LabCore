import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { appSessions, auditEvents } from '@/db/schema';
import { authorizeApi, isSameOriginRequest } from '@/lib/auth/api-guard';
import { hashSessionToken } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth/session';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const auth = await authorizeApi(false, undefined, request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const { id } = await context.params;
  try {
    const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value; const currentHash = token ? hashSessionToken(token) : '';
    const [session] = await db.select({ id: appSessions.id, tokenHash: appSessions.tokenHash }).from(appSessions).where(and(eq(appSessions.id, id), eq(appSessions.userId, auth.user.id), gt(appSessions.expiresAt, new Date()))).limit(1);
    if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    await db.delete(appSessions).where(eq(appSessions.id, session.id));
    await db.insert(auditEvents).values({ actorId: auth.user.id, action: 'SESSION_REVOKED', entityType: 'app_session', entityId: session.id, details: { current: session.tokenHash === currentHash } });
    const response = NextResponse.json({ ok: true, current: session.tokenHash === currentHash });
    if (session.tokenHash === currentHash) response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) { console.error('Session revoke failed', error); return NextResponse.json({ error: 'Unable to revoke session.' }, { status: 500 }); }
}
