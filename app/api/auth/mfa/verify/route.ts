import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth/session';
import { decryptMfaSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from '@/lib/auth/mfa';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
const schema = z.object({ code: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Enter the six-digit authenticator code.' }, { status: 400 });
  try {
    const result = await db.execute(sql`SELECT secret_ciphertext, enabled_at, pending_expires_at FROM app_mfa_credentials WHERE user_id = ${user.id}::uuid`);
    const row = result.rows[0] as { secret_ciphertext: string; enabled_at: Date | null; pending_expires_at: Date | null } | undefined;
    if (!row || row.enabled_at || !row.pending_expires_at || new Date(row.pending_expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'MFA enrollment expired. Start setup again.' }, { status: 409 });
    if (!verifyTotp(decryptMfaSecret(row.secret_ciphertext), parsed.data.code)) return NextResponse.json({ error: 'Authenticator code is invalid.' }, { status: 400 });
    const codes = generateRecoveryCodes();
    await db.transaction(async tx => {
      await tx.execute(sql`UPDATE app_mfa_credentials SET enabled_at = now(), pending_expires_at = NULL, updated_at = now() WHERE user_id = ${user.id}::uuid AND enabled_at IS NULL`);
      await tx.execute(sql`DELETE FROM app_mfa_recovery_codes WHERE user_id = ${user.id}::uuid`);
      for (const code of codes) await tx.execute(sql`INSERT INTO app_mfa_recovery_codes (user_id, code_hash) VALUES (${user.id}::uuid, ${hashRecoveryCode(code)})`);
      await tx.execute(sql`INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details) VALUES (${user.id}, 'MFA_ENABLED', 'app_user', ${user.id}, '{}'::jsonb)`);
    });
    return NextResponse.json({ enabled: true, recoveryCodes: codes, warning: 'Save these codes now. They are shown only once.' });
  } catch (error) { console.error('MFA verification failed', error); return NextResponse.json({ error: 'Unable to verify MFA.' }, { status: 500 }); }
}
