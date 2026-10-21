import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, criticalResultNotifications, labResultEvents, labResults } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';
const schema = z.object({ value: z.number().finite().min(-1e9).max(1e9), expectedVersion: z.number().int().positive() });
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'results.enter', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const { id } = await params; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'A finite numeric value and expectedVersion are required.' }, { status: 400 });
  try {
    const result = await db.transaction(async tx => {
      const [current] = await tx.select().from(labResults).where(eq(labResults.id, id)).for('update').limit(1);
      if (!current) throw Object.assign(new Error('Result not found.'), { statusCode: 404 });
      if (current.version !== parsed.data.expectedVersion) throw Object.assign(new Error('This result changed elsewhere. Reload before editing.'), { statusCode: 409 });
      if (current.status === 'Validated') throw Object.assign(new Error('Validated results are immutable. Use a governed correction workflow.'), { statusCode: 409 });
      const value = parsed.data.value; const critical = (current.criticalLow !== null && current.criticalLow !== undefined && value < Number(current.criticalLow)) || (current.criticalHigh !== null && current.criticalHigh !== undefined && value > Number(current.criticalHigh));
      const nextStatus = critical ? 'Critical pending' as const : 'Entered' as const;
      const [updated] = await tx.update(labResults).set({ value: String(value), status: nextStatus, enteredBy: auth.user.id, enteredAt: new Date(), reviewedBy: null, reviewedAt: null, validatedBy: null, validatedAt: null, version: current.version + 1, updatedAt: new Date() }).where(eq(labResults.id, id)).returning();
      await tx.insert(labResultEvents).values({ resultId: id, eventType: 'RESULT_VALUE_ENTERED', actorId: auth.user.id, fromStatus: current.status, toStatus: nextStatus, valueSnapshot: String(value), details: { version: updated.version, critical } });
      if (critical) { const [openNotification] = await tx.select({ id: criticalResultNotifications.id }).from(criticalResultNotifications).where(and(eq(criticalResultNotifications.resultId, id), inArray(criticalResultNotifications.notificationStatus, ['Pending','Notified','Escalated']))).limit(1); if (!openNotification) { const direction = current.criticalLow !== null && current.criticalLow !== undefined && value < Number(current.criticalLow) ? 'Low' : 'High'; await tx.insert(criticalResultNotifications).values({ resultId: id, criticalDirection: direction, criticalValue: String(value), unit: current.unit, triggeredBy: auth.user.id }); } }
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: 'RESULT_VALUE_ENTERED', entityType: 'lab_result', entityId: id, details: { fromStatus: current.status, toStatus: nextStatus, version: updated.version, critical } });
      return updated;
    });
    return NextResponse.json({ data: result });
  } catch (error) { const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500; if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status }); console.error('Result entry failed', error); return NextResponse.json({ error: 'Unable to update result.' }, { status: 500 }); }
}
