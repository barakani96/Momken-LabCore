import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appSessions, appUsers, auditEvents, authEvents, loginAttemptBuckets } from '@/db/schema';
import { hashSessionToken, verifyPassword } from '@/lib/auth/password';
import { decryptMfaSecret, hashRecoveryCode, verifyTotp } from '@/lib/auth/mfa';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
const inputSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256), totpCode: z.string().optional(), recoveryCode: z.string().optional() });
export async function POST(request: Request) {
  const originCheck = isSameOriginRequest(request);
  if (!originCheck.valid) return NextResponse.json({ error: `Cross-origin request rejected: ${originCheck.reason}` }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const bucketKey = createHash('sha256').update(`${ip}\u0000${email}`).digest('hex');
    const bucketResult = await db.execute(sql`INSERT INTO login_attempt_buckets (bucket_key, attempts, window_started_at, blocked_until, updated_at) VALUES (${bucketKey}, 1, now(), NULL, now()) ON CONFLICT (bucket_key) DO UPDATE SET attempts = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN 1 ELSE login_attempt_buckets.attempts + 1 END, window_started_at = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN now() ELSE login_attempt_buckets.window_started_at END, blocked_until = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN NULL WHEN login_attempt_buckets.attempts + 1 >= 8 THEN now() + interval '15 minutes' ELSE login_attempt_buckets.blocked_until END, updated_at = now() RETURNING attempts, blocked_until`);
    const bucket = bucketResult.rows[0] as { attempts: number; blocked_until: Date | null } | undefined;
    if (bucket?.blocked_until && new Date(bucket.blocked_until).getTime() > Date.now()) return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': '900' } });
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
    if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
      await db.insert(authEvents).values({ userId: user?.id ?? null, emailAttempted: email, eventType: 'LOGIN', outcome: 'FAILURE', ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null, userAgent: request.headers.get('user-agent')?.slice(0, 400) ?? null });
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }
    const mfaResult = await db.execute(sql`SELECT secret_ciphertext, enabled_at FROM app_mfa_credentials WHERE user_id = ${user.id}::uuid AND enabled_at IS NOT NULL`);
    const mfa = mfaResult.rows[0] as { secret_ciphertext: string; enabled_at: Date } | undefined;
    if (mfa) {
      let verified = false;
      if (parsed.data.totpCode) { try { verified = verifyTotp(decryptMfaSecret(mfa.secret_ciphertext), parsed.data.totpCode); } catch { return NextResponse.json({ error: 'MFA configuration error. Contact an administrator.' }, { status: 503 }); } }
      if (!verified && parsed.data.recoveryCode) {
        const consumed = await db.execute(sql`UPDATE app_mfa_recovery_codes SET used_at = now() WHERE user_id = ${user.id}::uuid AND code_hash = ${hashRecoveryCode(parsed.data.recoveryCode)} AND used_at IS NULL RETURNING id`);
        verified = consumed.rows.length > 0;
      }
      if (!verified) return NextResponse.json({ error: 'Authenticator code or unused recovery code required.', mfaRequired: true }, { status: 401 });
    }
    const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await db.transaction(async tx => {
      await tx.insert(appSessions).values({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt, userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null });
      await tx.update(appUsers).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(appUsers.id, user.id));
      await tx.insert(auditEvents).values({ actorId: user.id, action: 'LOGIN_SUCCESS', entityType: 'app_user', entityId: user.id, details: { role: user.role } });
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
      await tx.insert(authEvents).values({ userId: user.id, emailAttempted: email, eventType: 'LOGIN', outcome: 'SUCCESS', ipHash: ip ? createHash('sha256').update(ip).digest('hex') : null, userAgent: request.headers.get('user-agent')?.slice(0, 400) ?? null });
    });
    await db.delete(loginAttemptBuckets).where(eq(loginAttemptBuckets.bucketKey, bucketKey));
    const response = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
    return response;
  } catch (error) { console.error('Login failed', error); return NextResponse.json({ error: 'Unable to sign in.' }, { status: 500 }); }
}
