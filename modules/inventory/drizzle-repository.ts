import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { auditEvents, inventoryItems, inventoryLots, inventoryMovements } from '@/db/schema';
import { AppError } from '../../core/errors.ts';
import { summarizeItem, type LotStatus, type MovementType } from '../../lib/inventory.ts';
import type { InventoryTx, InventoryUnitOfWork, ItemRecord, LotRecord, MovementRecord } from './ports.ts';

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const isUniqueViolation = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return x?.code === '23505' || x?.cause?.code === '23505'; };

const toItem = (r: typeof inventoryItems.$inferSelect): ItemRecord => ({ id: r.id, itemCode: r.itemCode, name: r.name, category: r.category, unit: r.unit, storageCondition: r.storageCondition, reorderLevel: r.reorderLevel, supplier: r.supplier, active: r.active });
const toLot = (r: typeof inventoryLots.$inferSelect): LotRecord => ({ id: r.id, itemId: r.itemId, lotNumber: r.lotNumber, expiryDate: r.expiryDate, receivedQty: r.receivedQty, onHandQty: r.onHandQty, status: r.status as LotStatus, storageLocation: r.storageLocation, receivedAt: r.receivedAt });
const toMovement = (r: typeof inventoryMovements.$inferSelect): MovementRecord => ({ id: r.id, lotId: r.lotId, itemId: r.itemId, movementType: r.movementType as MovementType, quantityDelta: r.quantityDelta, balanceAfter: r.balanceAfter, reason: r.reason, reference: r.reference, actorId: r.actorId });

export function inventoryTxFor(tx: DbTx): InventoryTx {
  return {
    async getItem(id) { const [r] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1); return r ? toItem(r) : null; },
    async insertItem(item, createdBy) {
      try { const [r] = await tx.insert(inventoryItems).values({ ...item, createdBy }).returning(); return toItem(r); }
      catch (e) { if (isUniqueViolation(e)) throw new AppError('conflict', 'An item with this code already exists.'); throw e; }
    },
    async lockLotById(id) { const [r] = await tx.select().from(inventoryLots).where(eq(inventoryLots.id, id)).for('update'); return r ? toLot(r) : null; },
    async lockAvailableLotsForItem(itemId) {
      const rows = await tx.select().from(inventoryLots).where(and(eq(inventoryLots.itemId, itemId), eq(inventoryLots.status, 'Available'))).orderBy(asc(inventoryLots.expiryDate), asc(inventoryLots.receivedAt), asc(inventoryLots.id)).for('update');
      return rows.map(toLot);
    },
    async insertLot(l) {
      try { const [r] = await tx.insert(inventoryLots).values({ itemId: l.itemId, lotNumber: l.lotNumber, expiryDate: l.expiryDate, receivedQty: l.quantity, onHandQty: l.quantity, status: l.status, storageLocation: l.storageLocation, receivedBy: l.receivedBy }).returning(); return toLot(r); }
      catch (e) { if (isUniqueViolation(e)) throw new AppError('conflict', 'This lot number is already registered for the item.'); throw e; }
    },
    async updateLot(id, patch, at) { await tx.update(inventoryLots).set({ onHandQty: patch.onHandQty, status: patch.status, updatedAt: at }).where(eq(inventoryLots.id, id)); },
    async insertMovement(m) { const [r] = await tx.insert(inventoryMovements).values(m).returning(); return toMovement(r); },
    async audit(e) { await tx.insert(auditEvents).values(e); }
  };
}
export const inventoryUnitOfWork: InventoryUnitOfWork = { run: work => db.transaction(tx => work(inventoryTxFor(tx))) };

// Read side (queries) — kept separate from the write-side ports.
export async function listStock(now: Date) {
  const items = await db.select().from(inventoryItems).orderBy(asc(inventoryItems.name)).limit(500);
  const lots = items.length ? await db.select().from(inventoryLots).where(inArray(inventoryLots.itemId, items.map(i => i.id))).orderBy(asc(inventoryLots.expiryDate)) : [];
  const domainLots = lots.map(l => ({ id: l.id, itemId: l.itemId, lotNumber: l.lotNumber, expiryDate: l.expiryDate, receivedAt: l.receivedAt.toISOString(), onHandQty: l.onHandQty, status: l.status as LotStatus }));
  return { data: items.map(i => ({ ...i, summary: summarizeItem({ id: i.id, itemCode: i.itemCode, name: i.name, reorderLevel: i.reorderLevel, active: i.active }, domainLots, now) })), lots };
}
export async function listMovements(lotId?: string) {
  return db.select({ id: inventoryMovements.id, lotId: inventoryMovements.lotId, itemId: inventoryMovements.itemId, movementType: inventoryMovements.movementType, quantityDelta: inventoryMovements.quantityDelta, balanceAfter: inventoryMovements.balanceAfter, reason: inventoryMovements.reason, reference: inventoryMovements.reference, actorId: inventoryMovements.actorId, occurredAt: inventoryMovements.occurredAt, lotNumber: inventoryLots.lotNumber, itemCode: inventoryItems.itemCode, itemName: inventoryItems.name })
    .from(inventoryMovements).innerJoin(inventoryLots, eq(inventoryLots.id, inventoryMovements.lotId)).innerJoin(inventoryItems, eq(inventoryItems.id, inventoryMovements.itemId))
    .where(lotId ? eq(inventoryMovements.lotId, lotId) : undefined).orderBy(desc(inventoryMovements.id)).limit(200);
}
