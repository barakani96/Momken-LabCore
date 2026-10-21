import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, patients, specimens, specimenEvents } from '@/db/schema';
import { normalizePersonName } from '@/lib/order-validation';

const createSchema = z.object({
  patientNumber: z.string().trim().min(3).max(32), givenName: z.string().trim().min(1).max(100), familyName: z.string().trim().min(1).max(100),
  specimenType: z.string().trim().min(1).max(100), priority: z.enum(['Routine', 'Urgent', 'STAT']).default('Routine'),
  department: z.string().trim().min(1).max(120), orderingClinician: z.string().trim().min(1).max(160), testCodes: z.array(z.string().trim().min(1).max(24)).min(1).max(50)
});
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });

export async function GET() {
  const auth = await authorizeApi(false, 'specimens.read'); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const result = await db.select({ specimen: specimens, patient: patients }).from(specimens).innerJoin(patients, eq(specimens.patientId, patients.id)).orderBy(desc(specimens.collectedAt)).limit(500);
    return NextResponse.json({ data: result.map(({ specimen, patient }) => ({ ...specimen, patientNumber: patient.patientNumber, patientName: `${patient.givenName} ${patient.familyName}` })) });
  } catch (error) { console.error('Specimen list failed', error); return NextResponse.json({ error: 'Unable to load specimens.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(false, 'specimens.create', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const payload = await request.json().catch(() => null); const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid specimen payload.', issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data; const actor = auth.user.id;
  try {
    const created = await db.transaction(async tx => {
      const [patient] = await tx.select().from(patients).where(eq(patients.patientNumber, input.patientNumber)).limit(1);
      if (!patient) throw Object.assign(new Error('Patient ID was not found. Register the patient first.'), { statusCode: 404 });
      if (normalizePersonName(`${patient.givenName} ${patient.familyName}`) !== normalizePersonName(`${input.givenName} ${input.familyName}`)) throw Object.assign(new Error('Patient name does not match the registered patient ID.'), { statusCode: 409 });
      const sequenceResult = await tx.execute(sql`SELECT nextval('lab_specimen_seq')::text AS value`);
      const sequence = Number(sequenceResult.rows[0]?.value); if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error('Unable to allocate specimen accession.');
      const now = new Date(); const accession = `LAB-${now.getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
      const [specimen] = await tx.insert(specimens).values({ accession, patientId: patient.id, specimenType: input.specimenType, priority: input.priority, department: input.department, orderingClinician: input.orderingClinician, testCodes: [...new Set(input.testCodes)] }).returning();
      await tx.insert(specimenEvents).values({ specimenId: specimen.id, eventType: 'REGISTERED', fromStatus: null, toStatus: 'Collected', actorId: actor, details: { testCodes: specimen.testCodes } });
      await tx.insert(auditEvents).values({ actorId: actor, action: 'SPECIMEN_REGISTERED', entityType: 'specimen', entityId: specimen.id, details: { accession, patientNumber: patient.patientNumber } });
      return { ...specimen, patientNumber: patient.patientNumber, patientName: `${patient.givenName} ${patient.familyName}` };
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
    console.error('Specimen registration failed', error); return NextResponse.json({ error: 'Unable to register specimen. Verify migrations and patient registration.' }, { status: 500 });
  }
}
