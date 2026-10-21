import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditEvents, reportPortalGrants } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
 const auth = await authorizeApi(true, 'reports.portal.manage', request); if ('response' in auth) return auth.response;
 if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
 const { id } = await params;
 try {
  const [grant] = await db.update(reportPortalGrants).set({ revokedAt: new Date() }).where(and(eq(reportPortalGrants.id, id), isNull(reportPortalGrants.revokedAt))).returning({ id: reportPortalGrants.id });
  if (!grant) return NextResponse.json({ error: 'Grant not found or already revoked.' }, { status: 404 });
  await db.insert(auditEvents).values({ actorId: auth.user.id, action: 'PORTAL_REPORT_ACCESS_REVOKED', entityType: 'report_portal_grant', entityId: grant.id, details: {} });
  return NextResponse.json({ data: grant, revokedBy: auth.user.id });
 } catch (error) { console.error('Portal grant revoke failed', error); return NextResponse.json({ error: 'Unable to revoke access.' }, { status: 500 }); }
}
