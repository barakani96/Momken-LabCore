import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { labReports, reportPortalAccessEvents, reportPortalGrants } from '@/db/schema';

const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow' } });
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
 if (!process.env.DATABASE_URL) return fail(503, 'Portal is temporarily unavailable.');
 const { token } = await params;
 if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return fail(404, 'This report link is invalid or no longer available.');
 const tokenHash = createHash('sha256').update(token).digest('hex');
 const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
 const ipHash = ip ? createHash('sha256').update(ip).digest('hex') : null;
 const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
 try {
  const [grant] = await db.select({ id: reportPortalGrants.id, reportId: reportPortalGrants.reportId, expiresAt: reportPortalGrants.expiresAt, revokedAt: reportPortalGrants.revokedAt, snapshot: labReports.snapshot, reportNumber: labReports.reportNumber, version: labReports.version, status: labReports.status })
   .from(reportPortalGrants).innerJoin(labReports, eq(reportPortalGrants.reportId, labReports.id))
   .where(eq(reportPortalGrants.tokenHash, tokenHash)).limit(1);
  const valid = !!grant && !grant.revokedAt && grant.expiresAt > new Date() && grant.status === 'Released';
  await db.insert(reportPortalAccessEvents).values({ grantId: grant?.id ?? null, eventType: 'REPORT_VIEW', outcome: valid ? 'SUCCESS' : 'DENIED', ipHash, userAgent });
  if (!valid || !grant) return fail(404, 'This report link is invalid or no longer available.');
  await db.update(reportPortalGrants).set({ lastAccessedAt: new Date() }).where(eq(reportPortalGrants.id, grant.id));
  return NextResponse.json({ data: { reportNumber: grant.reportNumber, version: grant.version, snapshot: grant.snapshot }, warning: 'This secure link is bearer access. Anyone possessing it may view this report.' }, { headers: { 'Cache-Control': 'no-store, private', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } });
 } catch (error) { console.error('Patient portal report access failed', error); return fail(500, 'Unable to load report.'); }
}
