import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appPasswordRecoveryTokens, appUsers } from '@/db/schema';
import { isSameOriginRequest } from '@/lib/auth/api-guard';

const inputSchema = z.object({ email: z.string().email().max(254) });
const GENERIC = { message: 'If an active account matches that email, password recovery instructions will be sent.' };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

async function deliverRecovery(email: string, url: string) {
  const endpoint = process.env.MAIL_DELIVERY_URL;
  const key = process.env.MAIL_DELIVERY_TOKEN;
  if (!endpoint || !key) {
    if (process.env.NODE_ENV !== 'production') console.info(`[password-recovery] Configure MAIL_DELIVERY_URL and MAIL_DELIVERY_TOKEN to deliver recovery email for ${email}.`);
    return false;
  }
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ to: email, subject: 'Reset your Northstar password', text: `Use this one-time link to reset your password. It expires in 30 minutes: ${url}`, template: 'password-recovery', variables: { resetUrl: url, expiresInMinutes: 30 } }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Mail provider returned ${response.status}`);
  return true;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const bucketKey = sha256(`recovery\u0000${ip}\u0000${email}`);
    const bucketResult = await db.execute(sql`INSERT INTO login_attempt_buckets (bucket_key, attempts, window_started_at, blocked_until, updated_at) VALUES (${bucketKey}, 1, now(), NULL, now()) ON CONFLICT (bucket_key) DO UPDATE SET attempts = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN 1 ELSE login_attempt_buckets.attempts + 1 END, window_started_at = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN now() ELSE login_attempt_buckets.window_started_at END, blocked_until = CASE WHEN login_attempt_buckets.window_started_at < now() - interval '15 minutes' THEN NULL WHEN login_attempt_buckets.attempts + 1 >= 6 THEN now() + interval '15 minutes' ELSE login_attempt_buckets.blocked_until END, updated_at = now() RETURNING attempts, blocked_until`);
    const bucket = bucketResult.rows[0] as { blocked_until: Date | null } | undefined;
    if (bucket?.blocked_until && new Date(bucket.blocked_until).getTime() > Date.now()) return NextResponse.json(GENERIC);
    const [user] = await db.select({ id: appUsers.id, email: appUsers.email, active: appUsers.active }).from(appUsers).where(eq(appUsers.email, email)).limit(1);
    if (user?.active) {
      const token = randomBytes(32).toString('base64url');
      await db.transaction(async tx => {
        await tx.update(appPasswordRecoveryTokens).set({ usedAt: new Date() }).where(eq(appPasswordRecoveryTokens.userId, user.id));
        await tx.insert(appPasswordRecoveryTokens).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
      });
      const base = process.env.APP_BASE_URL || new URL(request.url).origin;
      const resetUrl = `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      try { await deliverRecovery(user.email, resetUrl); }
      catch (error) { console.error('Password recovery email delivery failed', error); }
      if (process.env.NODE_ENV !== 'production' && process.env.DEV_EXPOSE_RECOVERY_LINK === 'true') return NextResponse.json({ ...GENERIC, developmentResetUrl: resetUrl });
    }
    return NextResponse.json(GENERIC);
  } catch (error) { console.error('Password recovery request failed', error); return NextResponse.json({ error: 'Unable to process recovery request.' }, { status: 500 }); }
}
