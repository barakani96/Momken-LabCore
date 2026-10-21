import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth/session';
import { encryptMfaSecret, generateTotpSecret } from '@/lib/auth/mfa';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const secret = generateTotpSecret(); const encrypted = encryptMfaSecret(secret);
    const stored = await db.execute(sql`INSERT INTO app_mfa_credentials (user_id, secret_ciphertext, enabled_at, pending_expires_at, updated_at) VALUES (${user.id}::uuid, ${encrypted}, NULL, now() + interval '10 minutes', now()) ON CONFLICT (user_id) DO UPDATE SET secret_ciphertext = EXCLUDED.secret_ciphertext, pending_expires_at = EXCLUDED.pending_expires_at, updated_at = now() WHERE app_mfa_credentials.enabled_at IS NULL RETURNING user_id`);
    if (!stored.rows.length) return NextResponse.json({ error: 'MFA is already enabled. Verify your account before changing MFA settings.' }, { status: 409 });
    const issuer = 'Northstar ERP LIMS'; const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return NextResponse.json({ secret, otpauthUri: uri, expiresInSeconds: 600 });
  } catch (error) { console.error('MFA setup failed', error); return NextResponse.json({ error: 'MFA encryption is not configured. Set MFA_ENCRYPTION_KEY to 32 random bytes encoded as 64 hex characters.' }, { status: 503 }); }
}
