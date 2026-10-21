// In-memory implementation of the inventory and procurement ports for behavioural tests.
// Transactions snapshot state and restore it when the work throws, mirroring a database rollback.
import { AppError } from '../../core/errors.ts';
import { receiveLotInTx } from '../../modules/inventory/use-cases.ts';
import type { InventoryTx, InventoryUnitOfWork, ItemRecord, LotRecord, MovementRecord } from '../../modules/inventory/ports.ts';
import type { PoStatus, PurchaseOrder } from '../../modules/procurement/domain.ts';
import type { ProcurementTx, ProcurementUnitOfWork } from '../../modules/procurement/ports.ts';

export function createStore() {
  const s = { items: [] as ItemRecord[], lots: [] as LotRecord[], movements: [] as MovementRecord[], audits: [] as { action: string; entityId: string; details: Record<string, unknown> }[], orders: [] as PurchaseOrder[], receipts: [] as { lineId: string; lotId: string; movementId: number; quantity: number }[], seq: 0, ids: 0, clockTick: 0 };
  const id = (p: string) => `${p}-${++s.ids}`;
  const snapshot = () => structuredClone({ ...s, lots: s.lots.map(l => ({ ...l, receivedAt: l.receivedAt.toISOString() })) });
  const restore = (snap: ReturnType<typeof snapshot>) => { Object.assign(s, snap, { lots: snap.lots.map(l => ({ ...l, receivedAt: new Date(l.receivedAt) })) }); };
  const inv: InventoryTx = {
    async getItem(i) { return s.items.find(x => x.id === i) ?? null; },
    async insertItem(item) { if (s.items.some(x => x.itemCode === item.itemCode)) throw new AppError('conflict', 'An item with this code already exists.'); const r = { ...item, id: id('item'), active: true }; s.items.push(r); return r; },
    async lockLotById(i) { return s.lots.find(x => x.id === i) ?? null; },
    async lockAvailableLotsForItem(i) { return s.lots.filter(x => x.itemId === i && x.status === 'Available'); },
    async insertLot(l) { if (s.lots.some(x => x.itemId === l.itemId && x.lotNumber === l.lotNumber)) throw new AppError('conflict', 'This lot number is already registered for the item.'); const r: LotRecord = { id: id('lot'), itemId: l.itemId, lotNumber: l.lotNumber, expiryDate: l.expiryDate, receivedQty: l.quantity, onHandQty: l.quantity, status: l.status, storageLocation: l.storageLocation, receivedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, ++s.clockTick)) }; s.lots.push(r); return r; },
    async updateLot(i, patch) { const l = s.lots.find(x => x.id === i)!; l.onHandQty = patch.onHandQty; l.status = patch.status; },
    async insertMovement(m) { const r = { ...m, id: s.movements.length + 1 }; s.movements.push(r); return r; },
    async audit(e) { s.audits.push({ action: e.action, entityId: e.entityId, details: e.details }); }
  };
  const proc: ProcurementTx = {
    async nextOrderNumber(y) { return `PO-${y}-${String(++s.seq).padStart(6, '0')}`; },
    async findItems(ids) { return s.items.filter(i => ids.includes(i.id)).map(i => ({ id: i.id, itemCode: i.itemCode, name: i.name, active: i.active })); },
    async insertOrder(o) { const po: PurchaseOrder = { id: id('po'), poNumber: o.poNumber, supplier: o.supplier, currency: o.currency, status: 'Draft', createdBy: o.createdBy, approvedBy: null, lines: o.lines.map(l => ({ id: id('line'), itemId: l.itemId, orderedQty: l.orderedQty, receivedQty: 0, unitPriceMinor: l.unitPriceMinor })) }; s.orders.push(po); return structuredClone(po); },
    async lockOrder(i) { const o = s.orders.find(x => x.id === i); return o ? structuredClone(o) : null; },
    async setOrderStatus(i, status: PoStatus, approvedBy) { const o = s.orders.find(x => x.id === i)!; o.status = status; if (approvedBy) o.approvedBy = approvedBy; },
    async setLineReceived(lineId, qty) { for (const o of s.orders) for (const l of o.lines) if (l.id === lineId) l.receivedQty = qty; },
    async receiveStock(actorId, input) { const { lot, movement } = await receiveLotInTx(inv, { now: () => new Date('2026-10-21T10:00:00Z') }, actorId, input); return { lotId: lot.id, movementId: movement.id }; },
    async insertReceipt(r) { s.receipts.push({ lineId: r.lineId, lotId: r.lotId, movementId: r.movementId, quantity: r.quantity }); },
    audit: inv.audit
  };
  const atomically = async <T>(work: () => Promise<T>) => { const snap = snapshot(); try { return await work(); } catch (e) { restore(snap); throw e; } };
  const inventoryUow: InventoryUnitOfWork = { run: work => atomically(() => work(inv)) };
  const procurementUow: ProcurementUnitOfWork = { run: work => atomically(() => work(proc)) };
  return { state: s, inventoryUow, procurementUow, clock: { now: () => new Date('2026-10-21T10:00:00Z') } };
}
