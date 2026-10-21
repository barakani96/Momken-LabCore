import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, labResultEvents, labResults, patients, specimens, testCatalog } from '@/db/schema';
import { authorizeApi } from '@/lib/auth/api-guard';

const createSchema = z.object({ specimenId: z.string().uuid(), testCode: z.string().trim().min(1).max(32) });
const querySchema = z.object({ q: z.string().trim().max(120).optional(), status: z.enum(['All','Needs entry','Entered','Technical review','Validated','Critical pending']).default('All'), page: z.coerce.number().int().min(1).max(10000).default(1) });
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'results.read'); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid result filters.' }, { status: 400 });
  const { q, status, page } = parsed.data; const filters = [];
  if (status !== 'All') filters.push(eq(labResults.status, status));
  if (q) filters.push(or(ilike(specimens.accession, `%${q}%`), ilike(patients.patientNumber, `%${q}%`), ilike(patients.givenName, `%${q}%`), ilike(patients.familyName, `%${q}%`), ilike(labResults.testCode, `%${q}%`), ilike(labResults.testName, `%${q}%`))!);
  try {
    const rows = await db.select({ result: labResults, accession: specimens.accession, patientNumber: patients.patientNumber, givenName: patients.givenName, familyName: patients.familyName }).from(labResults).innerJoin(specimens, eq(labResults.specimenId, specimens.id)).innerJoin(patients, eq(specimens.patientId, patients.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(labResults.updatedAt)).limit(50).offset((page - 1) * 50);
    return NextResponse.json({ data: rows.map(r => ({ ...r.result, value: r.result.value === null ? '' : String(r.result.value), referenceLow: r.result.referenceLow === null ? null : String(r.result.referenceLow), referenceHigh: r.result.referenceHigh === null ? null : String(r.result.referenceHigh), criticalLow: r.result.criticalLow === null ? null : String(r.result.criticalLow), criticalHigh: r.result.criticalHigh === null ? null : String(r.result.criticalHigh), accession: r.accession, patientNumber: r.patientNumber, patientName: `${r.givenName} ${r.familyName}` })), page, pageSize: 50, hasMore: rows.length === 50 });
  } catch (error) { console.error('Result list failed', error); return NextResponse.json({ error: 'Unable to load results.' }, { status: 500 }); }
}
export async function POST(request: Request) {
  const auth = await authorizeApi(false, 'results.enter', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const parsed = createSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Invalid result creation payload.' }, { status: 400 });
  try {
    const created = await db.transaction(async tx => {
      const [specimen] = await tx.select().from(specimens).where(eq(specimens.id, parsed.data.specimenId)).limit(1);
      if (!specimen) throw Object.assign(new Error('Specimen not found.'), { statusCode: 404 });
      if (!(specimen.testCodes ?? []).includes(parsed.data.testCode)) throw Object.assign(new Error('The requested test is not on this specimen.'), { statusCode: 422 });
      const [existing] = await tx.select().from(labResults).where(and(eq(labResults.specimenId, specimen.id), eq(labResults.testCode, parsed.data.testCode))).limit(1);
      if (existing) throw Object.assign(new Error('A result record already exists for this specimen and test.'), { statusCode: 409 });
      const [test] = await tx.select().from(testCatalog).where(eq(testCatalog.code, parsed.data.testCode)).orderBy(desc(testCatalog.effectiveFrom)).limit(1);
      const [result] = await tx.insert(labResults).values({ specimenId: specimen.id, testCode: parsed.data.testCode, testName: test?.name ?? parsed.data.testCode, department: test?.department ?? specimen.department, unit: test?.unit ?? '' }).returning();
      await tx.insert(labResultEvents).values({ resultId: result.id, eventType: 'RESULT_CREATED', actorId: auth.user.id, fromStatus: null, toStatus: result.status, details: { specimenAccession: specimen.accession, testCode: result.testCode } });
      await tx.insert(auditEvents).values({ actorId: auth.user.id, action: 'RESULT_CREATED', entityType: 'lab_result', entityId: result.id, details: { specimenId: specimen.id, testCode: result.testCode } });
      return result;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) { const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500; if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status }); console.error('Result creation failed', error); return NextResponse.json({ error: 'Unable to create result.' }, { status: 500 }); }
}
