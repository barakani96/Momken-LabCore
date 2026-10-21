import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appSessions, appUsers, auditEvents, authEvents } from '@/db/schema';
import { hashPassword, hashSessionToken, verifyPassword } from '@/lib/auth/password';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
import { randomBytes } from 'node:crypto';
const schema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'New password must be at least 12 characters and include uppercase, lowercase, and a number.' }, { status: 400 });
  try {
    const store = await cookies(); const oldToken = store.get(SESSION_COOKIE)?.value; const sessionUser = await getSessionUser(oldToken);
    if (!sessionUser || !oldToken) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, sessionUser.id)).limit(1);
    if (!user || !verifyPassword(parsed.data.currentPassword, user.passwordHash)) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    if (verifyPassword(parsed.data.newPassword, user.passwordHash)) return NextResponse.json({ error: 'Choose a password different from the current password.' }, { status: 400 });
    const nextToken = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.transaction(async tx => {
      await tx.update(appUsers).set({ passwordHash: hashPassword(parsed.data.newPassword), passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(appUsers.id, user.id));
      await tx.delete(appSessions).where(eq(appSessions.userId, user.id));
      await tx.insert(appSessions).values({ userId: user.id, tokenHash: hashSessionToken(nextToken), expiresAt, userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null });
      await tx.insert(auditEvents).values({ actorId: user.id, action: 'PASSWORD_CHANGED', entityType: 'app_user', entityId: user.id, details: { sessionsRevoked: true, currentSessionRotated: true } });
      await tx.insert(authEvents).values({ userId: user.id, emailAttempted: user.email, eventType: 'PASSWORD_CHANGE', outcome: 'SUCCESS' });
    });
    const response = NextResponse.json({ message: 'Password changed. Other sessions have been signed out.' });
    response.cookies.set(SESSION_COOKIE, nextToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
    return response;
  } catch (error) { console.error('Password change failed', error); return NextResponse.json({ error: 'Unable to change password.' }, { status: 500 }); }
}
