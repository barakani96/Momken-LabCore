import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appUsers, auditEvents, userPermissionOverrides } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
const schema = z.object({ overrides: z.array(z.object({ permissionKey: z.enum(PERMISSIONS), allowed: z.boolean() })).max(PERMISSIONS.length) });
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'users.read'); if ('response' in auth) return auth.response;
  const { id } = await context.params;
  const rows = await db.select({ permissionKey: userPermissionOverrides.permissionKey, allowed: userPermissionOverrides.allowed }).from(userPermissionOverrides).where(eq(userPermissionOverrides.userId, id));
  return NextResponse.json({ overrides: rows });
}
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'users.manage', request); if ('response' in auth) return auth.response;
  const { id } = await context.params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid permission overrides.' }, { status: 400 });
  if (id === auth.user.id) return NextResponse.json({ error: 'You cannot change your own permission overrides.' }, { status: 409 });
  const [target] = await db.select({ id: appUsers.id, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (target.role === 'Admin') return NextResponse.json({ error: 'Administrator permissions are fixed and cannot be overridden.' }, { status: 409 });
  try {
    await db.transaction(async tx => {
      await tx.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, id));
      if (parsed.data.overrides.length) await tx.insert(userPermissionOverrides).values(parsed.data.overrides.map(item => ({ userId: id, permissionKey: item.permissionKey, allowed: item.allowed, grantedBy: auth.user.id, updatedAt: new Date() })));
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: 'USER_PERMISSIONS_UPDATED', entityType: 'app_user', entityId: id, details: { overrideCount: parsed.data.overrides.length } });
    });
    return NextResponse.json({ success: true, overrides: parsed.data.overrides });
  } catch (error) { console.error('Permission update failed', error); return NextResponse.json({ error: 'Unable to save permission overrides.' }, { status: 500 }); }
}
