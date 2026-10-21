import { NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { appSessions, appUsers, auditEvents } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
import { hashPassword } from '@/lib/auth/password';
const roles = ['Admin','Lab Manager','Lab Scientist','Phlebotomist','Viewer'] as const;
const createSchema = z.object({ email: z.string().email().max(254), displayName: z.string().trim().min(2).max(160), password: z.string().min(14).max(256), role: z.enum(roles) });
export async function GET() {
  const auth = await authorizeApi(false, 'users.read'); if ('response' in auth) return auth.response;
  const users = await db.select({ id: appUsers.id, email: appUsers.email, displayName: appUsers.displayName, role: appUsers.role, active: appUsers.active, createdAt: appUsers.createdAt, lastLoginAt: appUsers.lastLoginAt }).from(appUsers).orderBy(asc(appUsers.displayName));
  return NextResponse.json({ users });
}
export async function POST(request: Request) {
  const auth = await authorizeApi(false, 'users.manage', request); if ('response' in auth) return auth.response;
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Enter a valid email, name, role and password (minimum 14 characters).' }, { status: 400 });
  const email = body.data.email.trim().toLowerCase();
  try {
    const [created] = await db.transaction(async tx => {
      const rows = await tx.insert(appUsers).values({ email, displayName: body.data.displayName, passwordHash: hashPassword(body.data.password), role: body.data.role }).returning({ id: appUsers.id, email: appUsers.email, displayName: appUsers.displayName, role: appUsers.role, active: appUsers.active, createdAt: appUsers.createdAt });
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: 'USER_CREATED', entityType: 'app_user', entityId: rows[0].id, details: { role: rows[0].role, email: rows[0].email } });
      return rows;
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    console.error('User creation failed', error); return NextResponse.json({ error: 'Unable to create user.' }, { status: 500 });
  }
}
