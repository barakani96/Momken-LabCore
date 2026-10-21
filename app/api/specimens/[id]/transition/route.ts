import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, patients, specimens, specimenEvents } from '@/db/schema';
import { specimenStatuses, type SpecimenStatus } from '@/lib/specimens';

const schema = z.object({ status: z.enum(specimenStatuses), reason: z.string().trim().max(500).optional() });
const allowed: Record<SpecimenStatus, SpecimenStatus[]> = {
  'Collected': ['In progress', 'Rejected'], 'In progress': ['Pending review', 'Rejected'],
  'Pending review': ['In progress', 'Authorized', 'Rejected'], 'Authorized': [], 'Rejected': ['Collected']
};
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'specimens.transition', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const { id } = await params; const payload = await request.json().catch(() => null); const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid specimen transition.', issues: parsed.error.flatten() }, { status: 400 });
  const { status: next, reason } = parsed.data;
  if (next === 'Rejected' && !reason?.trim()) return NextResponse.json({ error: 'A rejection reason is required.' }, { status: 422 });
  const actor = auth.user.id;
  try {
    const data = await db.transaction(async tx => {
      const [current] = await tx.select().from(specimens).where(eq(specimens.id, id)).for('update').limit(1);
      if (!current) throw Object.assign(new Error('Specimen not found.'), { statusCode: 404 });
      if (!allowed[current.status].includes(next)) throw Object.assign(new Error(`Invalid specimen transition: ${current.status} → ${next}.`), { statusCode: 409 });
      if (current.status === 'Rejected' && next === 'Collected' && !reason?.trim()) throw Object.assign(new Error('Recollection details are required when reopening a rejected specimen.'), { statusCode: 422 });
      const [updated] = await tx.update(specimens).set({ status: next, updatedAt: new Date() }).where(eq(specimens.id, id)).returning();
      await tx.insert(specimenEvents).values({ specimenId: id, eventType: next === 'Rejected' ? 'REJECTED' : next === 'Collected' ? 'RECOLLECTED' : 'STATUS_CHANGED', fromStatus: current.status, toStatus: next, reason: reason?.trim() || null, actorId: actor });
      await tx.insert(auditEvents).values({ actorId: actor, action: 'SPECIMEN_STATUS_CHANGED', entityType: 'specimen', entityId: id, details: { accession: current.accession, fromStatus: current.status, toStatus: next, reason: reason?.trim() || null } });
      const [patient] = await tx.select().from(patients).where(eq(patients.id, current.patientId)).limit(1);
      return { ...updated, patientNumber: patient?.patientNumber, patientName: patient ? `${patient.givenName} ${patient.familyName}` : 'Unknown patient' };
    });
    return NextResponse.json({ data });
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
    console.error('Specimen transition failed', error); return NextResponse.json({ error: 'Unable to update specimen lifecycle.' }, { status: 500 });
  }
}
