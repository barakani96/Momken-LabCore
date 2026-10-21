import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, labResultEvents, labResults } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const schema = z.object({ action: z.enum(['review','validate']), expectedVersion: z.number().int().positive() });
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.clone().json().catch(() => null); const parsed = schema.safeParse(body);
  const auth = await authorizeApi(false, parsed.success ? 'results.validate' : 'results.read', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review action.' }, { status: 400 });
  const { id } = await params; const { action, expectedVersion } = parsed.data;
  try {
    const result = await db.transaction(async tx => {
      const [current] = await tx.select().from(labResults).where(eq(labResults.id, id)).for('update').limit(1);
      if (!current) throw Object.assign(new Error('Result not found.'), { statusCode: 404 });
      if (current.version !== expectedVersion) throw Object.assign(new Error('This result changed elsewhere. Reload before review.'), { statusCode: 409 });
      if (current.value === null) throw Object.assign(new Error('A result value is required.'), { statusCode: 422 });
      const value = Number(current.value); const critical = (current.criticalLow !== null && value < Number(current.criticalLow)) || (current.criticalHigh !== null && value > Number(current.criticalHigh));
      if (critical || current.status === 'Critical pending') throw Object.assign(new Error('Critical-range results require a separate critical-result escalation workflow.'), { statusCode: 422 });
      if (action === 'review' && current.status !== 'Entered') throw Object.assign(new Error('Only entered results can enter technical review.'), { statusCode: 409 });
      if (action === 'validate' && current.status !== 'Technical review') throw Object.assign(new Error('Only technically reviewed results can be validated.'), { statusCode: 409 });
      if (action === 'validate' && current.enteredBy === auth.user.id) throw Object.assign(new Error('Independent validation is required; the entering user cannot validate this result.'), { statusCode: 403 });
      const nextStatus = action === 'review' ? 'Technical review' as const : 'Validated' as const; const now = new Date();
      const [updated] = await tx.update(labResults).set({ status: nextStatus, ...(action === 'review' ? { reviewedBy: auth.user.id, reviewedAt: now } : { validatedBy: auth.user.id, validatedAt: now }), version: current.version + 1, updatedAt: now }).where(eq(labResults.id, id)).returning();
      await tx.insert(labResultEvents).values({ resultId: id, eventType: action === 'review' ? 'TECHNICAL_REVIEW' : 'RESULT_VALIDATED', actorId: auth.user.id, fromStatus: current.status, toStatus: nextStatus, valueSnapshot: current.value, details: { version: updated.version } });
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: action === 'review' ? 'RESULT_TECHNICAL_REVIEW' : 'RESULT_VALIDATED', entityType: 'lab_result', entityId: id, details: { fromStatus: current.status, toStatus: nextStatus, version: updated.version } });
      return updated;
    });
    return NextResponse.json({ data: result });
  } catch (error) { const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500; if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status }); console.error('Result review failed', error); return NextResponse.json({ error: 'Unable to complete result review.' }, { status: 500 }); }
}
