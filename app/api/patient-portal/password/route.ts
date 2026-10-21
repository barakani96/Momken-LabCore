import { cookies } from 'next/headers';
import { and, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, patientPortalAccounts, patientPortalSessions } from '@/db/schema';
import { getPatientPortalAccount, PATIENT_PORTAL_COOKIE } from '@/lib/auth/patient-portal';
import { hashPassword, hashSessionToken, verifyPassword } from '@/lib/auth/password';
import { isSameOriginRequest } from '@/lib/auth/api-guard';
const schema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(14).max(256) }).refine(v => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'Choose a different password.' });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Use a different password with at least 14 characters.' }, { status: 400 });
  try {
    const account = await getPatientPortalAccount(); if (!account || !account.passwordHash) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!verifyPassword(parsed.data.currentPassword, account.passwordHash)) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });
    const store = await cookies(); const token = store.get(PATIENT_PORTAL_COOKIE)?.value; if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const currentHash = hashSessionToken(token); const now = new Date();
    await db.transaction(async tx => {
      await tx.update(patientPortalAccounts).set({ passwordHash: hashPassword(parsed.data.newPassword), passwordChangedAt: now, updatedAt: now }).where(eq(patientPortalAccounts.id, account.id));
      await tx.delete(patientPortalSessions).where(and(eq(patientPortalSessions.accountId, account.id), ne(patientPortalSessions.tokenHash, currentHash)));
      await tx.insert(auditEvents).values({ actorId: `patient:${account.id}`, action: 'PATIENT_PORTAL_PASSWORD_CHANGED', entityType: 'patient_portal_account', entityId: account.id, details: { otherSessionsRevoked: true } });
    });
    return NextResponse.json({ data: { changed: true, otherSessionsRevoked: true } });
  } catch (error) { console.error('Patient password change failed', error); return NextResponse.json({ error: 'Unable to change password.' }, { status: 500 }); }
}
