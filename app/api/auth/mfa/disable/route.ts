import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth/session';
import { decryptMfaSecret, hashRecoveryCode, verifyTotp } from '@/lib/auth/mfa';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
const schema = z.object({ code: z.string().min(6).max(20) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Enter an authenticator or unused recovery code.' }, { status: 400 });
  try {
    const result = await db.execute(sql`SELECT secret_ciphertext, enabled_at FROM app_mfa_credentials WHERE user_id = ${user.id}::uuid`);
    const row = result.rows[0] as { secret_ciphertext: string; enabled_at: Date | null } | undefined;
    if (!row?.enabled_at) return NextResponse.json({ error: 'MFA is not enabled.' }, { status: 409 });
    const code = parsed.data.code;
    let valid = /^\d{6}$/.test(code) && verifyTotp(decryptMfaSecret(row.secret_ciphertext), code);
    if (!valid) {
      const used = await db.execute(sql`UPDATE app_mfa_recovery_codes SET used_at = now() WHERE user_id = ${user.id}::uuid AND code_hash = ${hashRecoveryCode(code)} AND used_at IS NULL RETURNING id`);
      valid = used.rows.length > 0;
    }
    if (!valid) return NextResponse.json({ error: 'Authenticator or recovery code is invalid.' }, { status: 400 });
    await db.transaction(async tx => {
      await tx.execute(sql`DELETE FROM app_mfa_credentials WHERE user_id = ${user.id}::uuid`);
      await tx.execute(sql`DELETE FROM app_mfa_recovery_codes WHERE user_id = ${user.id}::uuid`);
      await tx.execute(sql`DELETE FROM app_sessions WHERE user_id = ${user.id}::uuid`);
      await tx.execute(sql`INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details) VALUES (${user.id}, 'MFA_DISABLED', 'app_user', ${user.id}, '{}'::jsonb)`);
    });
    return NextResponse.json({ disabled: true, message: 'MFA disabled. Sign in again on other devices.' });
  } catch (error) { console.error('MFA disable failed', error); return NextResponse.json({ error: 'Unable to disable MFA.' }, { status: 500 }); }
}
