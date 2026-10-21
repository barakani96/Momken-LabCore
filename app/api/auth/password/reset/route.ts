import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appPasswordRecoveryTokens, appSessions, appUsers, auditEvents, authEvents } from '@/db/schema';
import { hashPassword } from '@/lib/auth/password';
import { isSameOriginRequest } from '@/lib/auth/api-guard';

const schema = z.object({ token: z.string().min(32).max(256), password: z.string().min(12).max(256).regex(/[a-z]/, 'Include a lowercase letter.').regex(/[A-Z]/, 'Include an uppercase letter.').regex(/[0-9]/, 'Include a number.') });
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Use a valid recovery link and a password of at least 12 characters containing uppercase, lowercase, and a number.' }, { status: 400 });
  try {
    const tokenHash = sha256(parsed.data.token);
    const result = await db.transaction(async tx => {
      const rows = await tx.execute(sqlToken(tokenHash));
      const row = rows.rows[0] as { id: string; user_id: string } | undefined;
      if (!row) return null;
      const [user] = await tx.update(appUsers).set({ passwordHash: hashPassword(parsed.data.password), passwordChangedAt: new Date(), updatedAt: new Date() }).where(and(eq(appUsers.id, row.user_id), eq(appUsers.active, true))).returning({ id: appUsers.id, email: appUsers.email });
      if (!user) return null;
      await tx.update(appPasswordRecoveryTokens).set({ usedAt: new Date() }).where(and(eq(appPasswordRecoveryTokens.userId, user.id), isNull(appPasswordRecoveryTokens.usedAt)));
      await tx.delete(appSessions).where(eq(appSessions.userId, user.id));
      await tx.insert(auditEvents).values({ actorId: user.id, action: 'PASSWORD_RESET', entityType: 'app_user', entityId: user.id, details: { sessionsRevoked: true } });
      await tx.insert(authEvents).values({ userId: user.id, emailAttempted: user.email, eventType: 'PASSWORD_RESET', outcome: 'SUCCESS' });
      return user;
    });
    if (!result) return NextResponse.json({ error: 'This recovery link is invalid, expired, or already used.' }, { status: 400 });
    return NextResponse.json({ message: 'Password updated. Sign in again with your new password.' });
  } catch (error) { console.error('Password reset failed', error); return NextResponse.json({ error: 'Unable to reset password.' }, { status: 500 }); }
}
function sqlToken(tokenHash: string) {
  return sql`UPDATE app_password_recovery_tokens SET used_at = now() WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now() RETURNING id, user_id`;
}
import { sql } from 'drizzle-orm';
