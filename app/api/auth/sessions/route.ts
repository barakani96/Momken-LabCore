import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { db } from '@/db';
import { appSessions, auditEvents } from '@/db/schema';
import { authorizeApi, isSameOriginRequest } from '@/lib/auth/api-guard';
import { hashSessionToken } from '@/lib/auth/password';
import { SESSION_COOKIE } from '@/lib/auth/session';

export async function GET(request: Request) {
  const auth = await authorizeApi(false, undefined, request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  try {
    const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value; const currentHash = token ? hashSessionToken(token) : '';
    if (currentHash) await db.update(appSessions).set({ lastSeenAt: new Date() }).where(and(eq(appSessions.userId, auth.user.id), eq(appSessions.tokenHash, currentHash)));
    const rows = await db.select({ id: appSessions.id, createdAt: appSessions.createdAt, lastSeenAt: appSessions.lastSeenAt, expiresAt: appSessions.expiresAt, userAgent: appSessions.userAgent, tokenHash: appSessions.tokenHash }).from(appSessions).where(and(eq(appSessions.userId, auth.user.id), gt(appSessions.expiresAt, new Date()))).orderBy(desc(appSessions.lastSeenAt));
    return NextResponse.json({ data: rows.map(({ tokenHash, ...row }) => ({ ...row, current: tokenHash === currentHash })) });
  } catch (error) { console.error('Session list failed', error); return NextResponse.json({ error: 'Unable to load sessions.' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const auth = await authorizeApi(false, undefined, request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  try {
    const store = await cookies(); const token = store.get(SESSION_COOKIE)?.value; const currentHash = token ? hashSessionToken(token) : '';
    const revoked = await db.delete(appSessions).where(and(eq(appSessions.userId, auth.user.id), ne(appSessions.tokenHash, currentHash))).returning({ id: appSessions.id });
    await db.insert(auditEvents).values({ actorId: auth.user.id, action: 'OTHER_SESSIONS_REVOKED', entityType: 'app_user', entityId: auth.user.id, details: { count: revoked.length } });
    return NextResponse.json({ revoked: revoked.length, message: 'Other sessions have been signed out.' });
  } catch (error) { console.error('Session revocation failed', error); return NextResponse.json({ error: 'Unable to revoke sessions.' }, { status: 500 }); }
}
