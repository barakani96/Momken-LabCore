import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, qualityCases, qualityCaseEvents } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

const schema = z.object({
  status: z.enum(['Open', 'Investigating', 'Action planned', 'Verification', 'Closed', 'Cancelled']).optional(),
  rootCause: z.string().trim().max(10000).nullable().optional(), correctiveAction: z.string().trim().max(10000).nullable().optional(),
  preventiveAction: z.string().trim().max(10000).nullable().optional(), effectivenessCheck: z.string().trim().max(10000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(), dueDate: z.string().datetime().nullable().optional(), notes: z.string().trim().max(2000).optional()
}).refine(v => Object.keys(v).some(k => k !== 'notes'), { message: 'At least one field must be changed.' });
const allowed: Record<string, string[]> = { Open: ['Investigating', 'Cancelled'], Investigating: ['Action planned', 'Cancelled'], 'Action planned': ['Verification', 'Investigating', 'Cancelled'], Verification: ['Closed', 'Action planned', 'Investigating'], Closed: [], Cancelled: [] };
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(true, 'quality.manage', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  const { id } = await params; const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid quality case update.', issues: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await db.transaction(async tx => {
      const [current] = await tx.select().from(qualityCases).where(eq(qualityCases.id, id)).limit(1);
      if (!current) return { missing: true as const };
      if (['Closed', 'Cancelled'].includes(current.status)) throw Object.assign(new Error('Closed cases are immutable. Reopen through a separately authorized process.'), { statusCode: 409 });
      const v = parsed.data; const nextStatus = v.status ?? current.status;
      if (v.status && v.status !== current.status && !allowed[current.status]?.includes(v.status)) throw Object.assign(new Error(`Invalid status transition: ${current.status} → ${v.status}.`), { statusCode: 409 });
      if (nextStatus === 'Action planned' && !(v.correctiveAction ?? current.correctiveAction) && !(v.preventiveAction ?? current.preventiveAction)) throw Object.assign(new Error('Document at least one corrective or preventive action before planning.'), { statusCode: 409 });
      if (nextStatus === 'Verification' && !(v.effectivenessCheck ?? current.effectivenessCheck)) throw Object.assign(new Error('Document an effectiveness check before verification.'), { statusCode: 409 });
      if (nextStatus === 'Closed' && !(v.effectivenessCheck ?? current.effectivenessCheck)) throw Object.assign(new Error('An effectiveness check is required before closure.'), { statusCode: 409 });
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      for (const key of ['rootCause','correctiveAction','preventiveAction','effectivenessCheck','ownerId'] as const) if (v[key] !== undefined) patch[key] = v[key];
      if (v.dueDate !== undefined) patch.dueDate = v.dueDate ? new Date(v.dueDate) : null;
      if (v.status) patch.status = v.status;
      if (v.status === 'Closed') patch.closedAt = new Date();
      const [updated] = await tx.update(qualityCases).set(patch).where(eq(qualityCases.id, id)).returning();
      const changes = Object.fromEntries(Object.entries(v).filter(([key, value]) => key !== 'notes' && value !== undefined));
      await tx.insert(qualityCaseEvents).values({ caseId: id, actorId: auth.user.id, eventType: v.status && v.status !== current.status ? 'STATUS_CHANGED' : 'CASE_UPDATED', fromStatus: current.status, toStatus: updated.status, notes: v.notes, changes });
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: v.status && v.status !== current.status ? 'QUALITY_CASE_STATUS_CHANGED' : 'QUALITY_CASE_UPDATED', entityType: 'quality_case', entityId: id, details: { fromStatus: current.status, toStatus: updated.status, changedFields: Object.keys(changes) } });
      return { data: updated };
    });
    if ('missing' in result) return NextResponse.json({ error: 'Quality case not found.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) { const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500; if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status }); console.error('Quality update failed', error); return NextResponse.json({ error: 'Unable to update quality case.' }, { status: 500 }); }
}
