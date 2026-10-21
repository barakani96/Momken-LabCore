import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { appSessions, appUsers } from '@/db/schema';
import { hashSessionToken } from './password';
export const SESSION_COOKIE = 'northstar_session';
export type AppRole = 'Admin' | 'Lab Manager' | 'Lab Scientist' | 'Phlebotomist' | 'Viewer';
export type AuthUser = { id: string; email: string; displayName: string; role: AppRole };
export async function getSessionUser(token?: string | null): Promise<AuthUser | null> {
  if (!token || !process.env.DATABASE_URL) return null;
  const rows = await db.select({ user: appUsers }).from(appSessions).innerJoin(appUsers, eq(appSessions.userId, appUsers.id))
    .where(and(eq(appSessions.tokenHash, hashSessionToken(token)), gt(appSessions.expiresAt, new Date()), eq(appUsers.active, true))).limit(1);
  const user = rows[0]?.user;
  return user ? { id: user.id, email: user.email, displayName: user.displayName, role: user.role } : null;
}
export async function getCurrentUser() {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}
export function roleCanWrite(role: AppRole) { return ['Admin', 'Lab Manager', 'Lab Scientist', 'Phlebotomist'].includes(role); }
