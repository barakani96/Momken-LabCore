import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents, labOrderItems, labOrders, orderAccessioning, patients, specimens, specimenEvents, testCatalog } from '@/db/schema';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(false, 'orders.accession', request); if ('response' in auth) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database is not configured. Set DATABASE_URL and apply migrations.' }, { status: 503 });
  const { id } = await context.params;
  try {
    const data = await db.transaction(async tx => {
      const [order] = await tx.select().from(labOrders).where(eq(labOrders.id, id)).limit(1).for('update');
      if (!order) throw Object.assign(new Error('Order not found.'), { statusCode: 404 });
      if (order.status !== 'Ordered') throw Object.assign(new Error('Only orders in Ordered status can be accessioned.'), { statusCode: 409 });
      const [patient] = await tx.select().from(patients).where(eq(patients.id, order.patientId)).limit(1);
      const items = await tx.select().from(labOrderItems).where(eq(labOrderItems.orderId, order.id));
      if (!items.length) throw new Error('Order has no test items.');
      const testRows = await tx.select().from(testCatalog).where(eq(testCatalog.specimenType, order.specimenType));
      const department = testRows.find(test => items.some(item => item.testId === test.id))?.department ?? 'Laboratory';
      const actor = auth.user.id;
      // This increment creates one primary specimen per order; later aliquot workflows can introduce child specimen identifiers.
      const specimenAccession = `${order.accession}-S01`;
      const [specimen] = await tx.insert(specimens).values({
        accession: specimenAccession, patientId: order.patientId, specimenType: order.specimenType,
        priority: order.priority, status: 'Collected', department, orderingClinician: order.orderingClinician,
        testCodes: items.map(item => item.testCodeSnapshot)
      }).returning();
      await tx.insert(orderAccessioning).values({ orderId: order.id, specimenId: specimen.id, accessionedBy: actor });
      await tx.insert(specimenEvents).values({ specimenId: specimen.id, eventType: 'ACCESSIONED', fromStatus: null, toStatus: 'Collected', actorId: actor, details: { orderId: order.id, orderAccession: order.accession } });
      const [updated] = await tx.update(labOrders).set({ status: 'Collected', updatedAt: new Date() }).where(eq(labOrders.id, order.id)).returning();
      await tx.insert(auditEvents).values({ actorId: actor, action: 'ORDER_ACCESSIONED', entityType: 'lab_order', entityId: order.id,
        details: { orderAccession: order.accession, specimenAccession, specimenType: order.specimenType, testCodes: items.map(item => item.testCodeSnapshot) } });
      return { orderId: updated.id, orderAccession: updated.accession, status: updated.status,
        specimen: { id: specimen.id, accession: specimen.accession, specimenType: specimen.specimenType, patientNumber: patient?.patientNumber } };
    });
    return NextResponse.json({ data });
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500;
    if (status !== 500 && error instanceof Error) return NextResponse.json({ error: error.message }, { status });
    console.error('Order accessioning failed', error);
    return NextResponse.json({ error: 'Unable to accession order. Check the database migration and order state.' }, { status: 500 });
  }
}
