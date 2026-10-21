import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { patientPortalAccounts, patientPortalSessions } from '@/db/schema';
import { hashSessionToken } from './password';
export const PATIENT_PORTAL_COOKIE = 'northstar_patient_session';
export async function getPatientPortalAccount() {
 const store = await cookies(); const token = store.get(PATIENT_PORTAL_COOKIE)?.value;
 if (!token || !process.env.DATABASE_URL) return null;
 const [row] = await db.select({ account: patientPortalAccounts }).from(patientPortalSessions).innerJoin(patientPortalAccounts, eq(patientPortalSessions.accountId, patientPortalAccounts.id))
  .where(and(eq(patientPortalSessions.tokenHash, hashSessionToken(token)), gt(patientPortalSessions.expiresAt, new Date()), eq(patientPortalAccounts.active, true))).limit(1);
 return row?.account ?? null;
}
