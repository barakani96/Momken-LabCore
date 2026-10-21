import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, labReports, reportPortalGrants } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

const createSchema = z.object({ reportId: z.string().uuid(), expiresInDays: z.coerce.number().int().min(1).max(30).default(7) });
const unavailable = () => NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });

export async function GET() {
  const auth = await authorizeApi(false, 'reports.portal.manage'); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const rows = await db.select({ id: reportPortalGrants.id, reportId: reportPortalGrants.reportId, reportNumber: labReports.reportNumber, version: labReports.version, expiresAt: reportPortalGrants.expiresAt, revokedAt: reportPortalGrants.revokedAt, createdAt: reportPortalGrants.createdAt, lastAccessedAt: reportPortalGrants.lastAccessedAt })
      .from(reportPortalGrants).innerJoin(labReports, eq(reportPortalGrants.reportId, labReports.id)).orderBy(desc(reportPortalGrants.createdAt)).limit(100);
    return NextResponse.json({ data: rows });
  } catch (error) { console.error('Portal grants list failed', error); return NextResponse.json({ error: 'Unable to load portal grants.' }, { status: 500 }); }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(true, 'reports.portal.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report access request.' }, { status: 400 });
  try {
    const [report] = await db.select({ id: labReports.id, status: labReports.status }).from(labReports).where(eq(labReports.id, parsed.data.reportId)).limit(1);
    if (!report || report.status !== 'Released') return NextResponse.json({ error: 'Only a released report can be shared.' }, { status: 422 });
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86400000);
    const [grant] = await db.insert(reportPortalGrants).values({ reportId: report.id, tokenHash, expiresAt, createdBy: auth.user.id }).returning({ id: reportPortalGrants.id, reportId: reportPortalGrants.reportId, expiresAt: reportPortalGrants.expiresAt });
    await db.insert(auditEvents).values({ actorId: auth.user.id, action: 'PORTAL_REPORT_ACCESS_CREATED', entityType: 'report_portal_grant', entityId: grant.id, details: { reportId: report.id, expiresAt: expiresAt.toISOString() } });
    return NextResponse.json({ data: { ...grant, token, path: `/portal/${token}` }, warning: 'This bearer link grants access to the report. Share it only through an approved secure channel; it is shown only once.' }, { status: 201 });
  } catch (error) { console.error('Portal grant creation failed', error); return NextResponse.json({ error: 'Unable to create secure access.' }, { status: 500 }); }
}
