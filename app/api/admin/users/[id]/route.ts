import { NextResponse } from 'next/server';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appSessions, appUsers, auditEvents } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const schema = z.object({ role: z.enum(['Admin','Lab Manager','Lab Scientist','Phlebotomist','Viewer']).optional(), active: z.boolean().optional(), displayName: z.string().trim().min(2).max(160).optional() }).refine(v => Object.keys(v).length > 0);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'users.manage', request); if ('response' in auth) return auth.response;
  const { id } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid user update.' }, { status: 400 });
  if (id === auth.user.id && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== 'Admin'))) return NextResponse.json({ error: 'You cannot deactivate or demote your own account.' }, { status: 409 });
  try {
    const result = await db.transaction(async tx => {
      // Serialize administrator role/status changes to avoid concurrent last-admin lockout.
      await tx.select({ id: appUsers.id }).from(appUsers).where(and(eq(appUsers.role, 'Admin'), eq(appUsers.active, true))).for('update');
      const [target] = await tx.select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
      if (!target) return null;
      if (target.role === 'Admin' && target.active && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== 'Admin'))) {
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(appUsers).where(and(eq(appUsers.role, 'Admin'), eq(appUsers.active, true), ne(appUsers.id, id)));
        if (count === 0) throw new Error('LAST_ACTIVE_ADMIN');
      }
      const [updated] = await tx.update(appUsers).set({ ...parsed.data, updatedAt: new Date() }).where(eq(appUsers.id, id)).returning({ id: appUsers.id, email: appUsers.email, displayName: appUsers.displayName, role: appUsers.role, active: appUsers.active, createdAt: appUsers.createdAt, lastLoginAt: appUsers.lastLoginAt });
      if (parsed.data.active === false) await tx.delete(appSessions).where(eq(appSessions.userId, id));
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: parsed.data.active === false ? 'USER_DEACTIVATED' : 'USER_UPDATED', entityType: 'app_user', entityId: id, details: { changedFields: Object.keys(parsed.data) } });
      return updated;
    });
    return result ? NextResponse.json({ user: result }) : NextResponse.json({ error: 'User not found.' }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ACTIVE_ADMIN') return NextResponse.json({ error: 'At least one active administrator must remain.' }, { status: 409 });
    console.error('User update failed', error); return NextResponse.json({ error: 'Unable to update user.' }, { status: 500 });
  }
}
