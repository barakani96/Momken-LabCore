import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, gt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, labOrderItems, labOrders, orderAccessioning, patients, specimens, testCatalog } from '@/db/schema';
import { normalizePersonName, validatePersistentOrder } from '@/lib/order-validation';

const schema = z.object({
  patientNumber: z.string().trim().min(3).max(32),
  patientName: z.string().trim().min(1).max(201),
  clinician: z.string().trim().min(1).max(160),
  priority: z.enum(['Routine', 'Urgent', 'STAT']).default('Routine'),
  testCodes: z.array(z.string().trim().min(1).max(32)).min(1).max(50)
});
const unavailable = () => NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });

export async function GET() {
  const auth = await authorizeApi(false, 'orders.read'); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    const rows = await db.select({ order: labOrders, patient: patients }).from(labOrders)
      .innerJoin(patients, eq(labOrders.patientId, patients.id)).orderBy(desc(labOrders.orderedAt)).limit(250);
    const ids = rows.map(row => row.order.id);
    const items = ids.length ? await db.select().from(labOrderItems).where(inArray(labOrderItems.orderId, ids)) : [];
    const accessionRows = ids.length ? await db.select({ orderId: orderAccessioning.orderId, accession: specimens.accession }).from(orderAccessioning).innerJoin(specimens, eq(orderAccessioning.specimenId, specimens.id)).where(inArray(orderAccessioning.orderId, ids)) : [];
    const specimenByOrder = new Map(accessionRows.map(row => [row.orderId, row.accession] as const));
    const byOrder = new Map<string, typeof items>();
    for (const item of items) byOrder.set(item.orderId, [...(byOrder.get(item.orderId) ?? []), item]);
    return NextResponse.json({ data: rows.map(({ order, patient }) => ({
      id: order.id, accession: order.accession, patientNumber: patient.patientNumber,
      patientName: `${patient.givenName} ${patient.familyName}`, clinician: order.orderingClinician,
      priority: order.priority, status: order.status, specimenType: order.specimenType,
      testCodes: (byOrder.get(order.id) ?? []).map(item => item.testCodeSnapshot),
      orderedAt: order.orderedAt, specimenAccession: specimenByOrder.get(order.id)
    })) });
  } catch (error) {
    console.error('Order list failed', error);
    return NextResponse.json({ error: 'Unable to load laboratory orders.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeApi(false, 'orders.create', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return unavailable();
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload.', issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  try {
    const created = await db.transaction(async tx => {
      const [patient] = await tx.select().from(patients).where(eq(patients.patientNumber, input.patientNumber)).limit(1);
      if (!patient) throw Object.assign(new Error('Patient ID was not found. Select an existing registered patient.'), { statusCode: 404 });
      const actualName = `${patient.givenName} ${patient.familyName}`;
      if (normalizePersonName(actualName) !== normalizePersonName(input.patientName)) {
        throw Object.assign(new Error('Patient name does not match the registered patient ID.'), { statusCode: 409 });
      }
      const codes = [...new Set(input.testCodes)];
      const now = new Date();
      const tests = await tx.select().from(testCatalog).where(and(
        inArray(testCatalog.code, codes), eq(testCatalog.status, 'Active'),
        sql`${testCatalog.effectiveFrom} <= ${now}`,
        or(isNull(testCatalog.effectiveTo), gt(testCatalog.effectiveTo, now))
      ));
      const validation = validatePersistentOrder({ ...input, testCodes: codes }, tests.map(test => ({
        id: test.id, code: test.code, name: test.name, version: test.version,
        specimenType: test.specimenType, department: test.department
      })));
      if (validation.errors.length) throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 422 });
      const sequenceResult = await tx.execute(sql`SELECT nextval('lab_accession_seq')::text AS value`);
      const sequence = Number(sequenceResult.rows[0]?.value);
      if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error('Unable to allocate accession number.');
      const accession = `NS-${now.getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
      const actor = auth.user.id;
      const [order] = await tx.insert(labOrders).values({
        accession, patientId: patient.id, orderingClinician: input.clinician,
        priority: input.priority, specimenType: validation.specimenType!, createdBy: actor
      }).returning();
      await tx.insert(labOrderItems).values(tests.map(test => ({
        orderId: order.id, testId: test.id, testCodeSnapshot: test.code,
        testNameSnapshot: test.name, catalogVersionSnapshot: test.version
      })));
      await tx.insert(auditEvents).values({ actorId: actor, action: 'ORDER_CREATED', entityType: 'lab_order', entityId: order.id,
        details: { accession, patientNumber: patient.patientNumber, testCodes: tests.map(test => test.code), priority: input.priority } });
      return { id: order.id, accession, patientNumber: patient.patientNumber, patientName: actualName,
        clinician: order.orderingClinician, priority: order.priority, status: order.status,
        specimenType: order.specimenType, testCodes: tests.map(test => test.code), orderedAt: order.orderedAt };
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
    console.error('Order creation failed', error);
    return NextResponse.json({ error: 'Unable to create order. Verify the database migration and active catalog.' }, { status: 500 });
  }
}
