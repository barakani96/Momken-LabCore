import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import { asc, ilike, or, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { patients, auditEvents } from '@/db/schema';

const schema = z.object({
  patientNumber: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens, or underscores for patient ID.'),
  givenName: z.string().trim().min(1).max(100), familyName: z.string().trim().min(1).max(100),
  dateOfBirth: z.string().date().optional().or(z.literal('')),
  sexAtBirth: z.enum(['Female', 'Male', 'Intersex', 'Unknown']).optional()
});
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });

export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'patients.read'); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const url = new URL(request.url); const query = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  try {
    const rows = await db.select().from(patients).where(query ? or(
      ilike(patients.patientNumber, `%${query}%`), ilike(patients.givenName, `%${query}%`), ilike(patients.familyName, `%${query}%`)
    ) : undefined).orderBy(desc(patients.createdAt), asc(patients.familyName)).limit(250);
    return NextResponse.json({ data: rows });
  } catch (error) { console.error('Patient search failed', error); return NextResponse.json({ error: 'Unable to search patient registry.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(false, 'patients.create', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const payload = await request.json().catch(() => null); const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid patient record.', issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data; const actor = auth.user.id;
  try {
    const created = await db.transaction(async tx => {
      const [patient] = await tx.insert(patients).values({
        patientNumber: input.patientNumber, givenName: input.givenName, familyName: input.familyName,
        dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : undefined,
        sexAtBirth: input.sexAtBirth
      }).onConflictDoNothing({ target: patients.patientNumber }).returning();
      if (!patient) throw Object.assign(new Error('Patient ID already exists. Search for the existing record instead of creating a duplicate.'), { statusCode: 409 });
      await tx.insert(auditEvents).values({ actorId: actor, action: 'PATIENT_REGISTERED', entityType: 'patient', entityId: patient.id, details: { patientNumber: patient.patientNumber } });
      return patient;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
    console.error('Patient registration failed', error); return NextResponse.json({ error: 'Unable to register patient.' }, { status: 500 });
  }
}
