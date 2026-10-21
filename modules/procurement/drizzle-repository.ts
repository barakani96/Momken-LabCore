import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents, inventoryItems, purchaseOrderLines, purchaseOrderReceipts, purchaseOrders } from '@/db/schema';
import { systemClock } from '../../core/errors.ts';
import { inventoryTxFor, type DbTx } from '../inventory/drizzle-repository';
import { receiveLotInTx } from '../inventory/use-cases.ts';
import type { PoStatus, PurchaseOrder } from './domain.ts';
import type { ProcurementTx, ProcurementUnitOfWork } from './ports.ts';

const loadOrder = async (tx: DbTx | typeof db, id: string, lock: boolean): Promise<PurchaseOrder | null> => {
  const q = tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
  const [o] = lock ? await (q as ReturnType<typeof q.for>).for('update') : await q;
  if (!o) return null;
  const lines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.orderId, id)).orderBy(purchaseOrderLines.id);
  return { id: o.id, poNumber: o.poNumber, supplier: o.supplier, currency: o.currency, status: o.status as PoStatus, createdBy: o.createdBy, approvedBy: o.approvedBy, lines: lines.map(l => ({ id: l.id, itemId: l.itemId, orderedQty: l.orderedQty, receivedQty: l.receivedQty, unitPriceMinor: l.unitPriceMinor })) };
};

function procurementTxFor(tx: DbTx): ProcurementTx {
  return {
    async nextOrderNumber(year) { const r = await tx.execute(sql`select nextval('purchase_order_number_seq') as n`); return `PO-${year}-${String((r.rows[0] as { n: string }).n).padStart(6, '0')}`; },
    async findItems(ids) { if (!ids.length) return []; const rows = await tx.select({ id: inventoryItems.id, itemCode: inventoryItems.itemCode, name: inventoryItems.name, active: inventoryItems.active }).from(inventoryItems).where(inArray(inventoryItems.id, ids)); return rows; },
    async insertOrder(o) {
      const [row] = await tx.insert(purchaseOrders).values({ poNumber: o.poNumber, supplier: o.supplier, currency: o.currency, createdBy: o.createdBy }).returning();
      await tx.insert(purchaseOrderLines).values(o.lines.map(l => ({ orderId: row.id, itemId: l.itemId, orderedQty: l.orderedQty, unitPriceMinor: l.unitPriceMinor })));
      return (await loadOrder(tx, row.id, false))!;
    },
    lockOrder: id => loadOrder(tx, id, true),
    async setOrderStatus(id, status, approvedBy) { await tx.update(purchaseOrders).set({ status, updatedAt: new Date(), ...(approvedBy ? { approvedBy, approvedAt: new Date() } : {}) }).where(eq(purchaseOrders.id, id)); },
    async setLineReceived(lineId, receivedQty) { await tx.update(purchaseOrderLines).set({ receivedQty }).where(eq(purchaseOrderLines.id, lineId)); },
    async receiveStock(actorId, input) { const { lot, movement } = await receiveLotInTx(inventoryTxFor(tx), systemClock, actorId, input); return { lotId: lot.id, movementId: movement.id }; },
    async insertReceipt(r) { await tx.insert(purchaseOrderReceipts).values(r); },
    async audit(e) { await tx.insert(auditEvents).values(e); }
  };
}
export const procurementUnitOfWork: ProcurementUnitOfWork = { run: work => db.transaction(tx => work(procurementTxFor(tx))) };

export async function listOrders(status?: string) {
  const orders = await db.select().from(purchaseOrders).where(status ? eq(purchaseOrders.status, status) : undefined).orderBy(desc(purchaseOrders.createdAt)).limit(200);
  if (!orders.length) return [];
  const lines = await db.select({ id: purchaseOrderLines.id, orderId: purchaseOrderLines.orderId, itemId: purchaseOrderLines.itemId, orderedQty: purchaseOrderLines.orderedQty, receivedQty: purchaseOrderLines.receivedQty, unitPriceMinor: purchaseOrderLines.unitPriceMinor, itemCode: inventoryItems.itemCode, itemName: inventoryItems.name, unit: inventoryItems.unit })
    .from(purchaseOrderLines).innerJoin(inventoryItems, eq(inventoryItems.id, purchaseOrderLines.itemId)).where(inArray(purchaseOrderLines.orderId, orders.map(o => o.id)));
  return orders.map(o => ({ ...o, lines: lines.filter(l => l.orderId === o.id) }));
}
