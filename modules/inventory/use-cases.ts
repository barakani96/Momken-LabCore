import { AppError, type Clock } from '../../core/errors.ts';
import { allocateFefo, isCalendarDate, utcDate, validateMovement, type Lot, type LotStatus, type MovementType } from '../../lib/inventory.ts';
import type { InventoryTx, InventoryUnitOfWork, ItemRecord, LotRecord, MovementRecord, NewItem } from './ports.ts';

const toDomain = (l: LotRecord): Lot => ({ id: l.id, itemId: l.itemId, lotNumber: l.lotNumber, expiryDate: l.expiryDate, receivedAt: l.receivedAt.toISOString(), onHandQty: l.onHandQty, status: l.status });

export async function createItem(uow: InventoryUnitOfWork, actorId: string, input: NewItem): Promise<ItemRecord> {
  return uow.run(async tx => {
    const item = await tx.insertItem(input, actorId);
    await tx.audit({ actorId, action: 'INVENTORY_ITEM_CREATED', entityType: 'inventory_item', entityId: item.id, details: { itemCode: item.itemCode, category: item.category, reorderLevel: item.reorderLevel } });
    return item;
  });
}

export type ReceiveLotInput = { itemId: string; lotNumber: string; expiryDate: string; quantity: number; storageLocation?: string; reference?: string; quarantineOnReceipt?: boolean };

// Public entry point other modules use to put stock on the shelf inside their own transaction (for example purchase-order receiving).
export async function receiveLotInTx(tx: InventoryTx, clock: Clock, actorId: string, input: ReceiveLotInput): Promise<{ lot: LotRecord; movement: MovementRecord }> {
  if (!isCalendarDate(input.expiryDate)) throw new AppError('validation', 'Expiry must be a valid date (YYYY-MM-DD).');
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new AppError('validation', 'Quantity must be a whole number of at least 1.');
  if (!input.lotNumber.trim()) throw new AppError('validation', 'Lot number is required.');
  if (input.expiryDate < utcDate(clock.now())) throw new AppError('rule', 'A lot that is already expired cannot be received.');
  const item = await tx.getItem(input.itemId);
  if (!item) throw new AppError('not_found', 'Inventory item not found.');
  if (!item.active) throw new AppError('rule', 'Inactive items cannot receive stock.');
  const status: LotStatus = input.quarantineOnReceipt ? 'Quarantined' : 'Available';
  const lot = await tx.insertLot({ itemId: item.id, lotNumber: input.lotNumber.trim(), expiryDate: input.expiryDate, quantity: input.quantity, status, storageLocation: input.storageLocation || null, receivedBy: actorId });
  const movement = await tx.insertMovement({ lotId: lot.id, itemId: item.id, movementType: 'receive', quantityDelta: input.quantity, balanceAfter: input.quantity, reason: null, reference: input.reference || null, actorId });
  await tx.audit({ actorId, action: 'INVENTORY_LOT_RECEIVED', entityType: 'inventory_lot', entityId: lot.id, details: { itemCode: item.itemCode, lotNumber: lot.lotNumber, expiryDate: lot.expiryDate, quantity: input.quantity, status, reference: input.reference ?? null } });
  return { lot, movement };
}
export const receiveLot = (uow: InventoryUnitOfWork, clock: Clock, actorId: string, input: ReceiveLotInput) => uow.run(tx => receiveLotInTx(tx, clock, actorId, input));

export type MovementInput = { type: Exclude<MovementType, 'receive'>; lotId?: string; itemId?: string; quantity: number; reason?: string; reference?: string };

export async function recordMovement(uow: InventoryUnitOfWork, clock: Clock, actorId: string, input: MovementInput): Promise<MovementRecord[]> {
  if (!input.lotId && !input.itemId) throw new AppError('validation', 'Provide a lot, or an item for first-expired-first-out consumption.');
  if (input.itemId && input.lotId) throw new AppError('validation', 'Choose either a lot or an item, not both.');
  if (input.itemId && input.type !== 'consume') throw new AppError('validation', 'This movement applies to a specific lot.');
  const now = clock.now();
  return uow.run(async tx => {
    type Step = { lot: LotRecord; delta: number; nextStatus: LotStatus };
    const steps: Step[] = [];
    if (input.lotId) {
      const lot = await tx.lockLotById(input.lotId);
      if (!lot) throw new AppError('not_found', 'Lot not found.');
      const check = validateMovement(toDomain(lot), input.type, input.quantity, input.reason, now);
      if (!check.ok) throw new AppError('rule', check.error);
      steps.push({ lot, delta: check.delta, nextStatus: check.nextStatus });
    } else {
      const lots = await tx.lockAvailableLotsForItem(input.itemId!);
      const fefo = allocateFefo(lots.map(toDomain), input.quantity, now);
      if (!fefo.ok) throw new AppError('rule', fefo.error);
      for (const a of fefo.allocations) {
        const lot = lots.find(l => l.id === a.lotId)!;
        const check = validateMovement(toDomain(lot), 'consume', a.quantity, input.reason, now);
        if (!check.ok) throw new AppError('rule', check.error);
        steps.push({ lot, delta: check.delta, nextStatus: check.nextStatus });
      }
    }
    const movements: MovementRecord[] = [];
    for (const s of steps) {
      const balance = s.lot.onHandQty + s.delta;
      await tx.updateLot(s.lot.id, { onHandQty: balance, status: s.nextStatus }, now);
      movements.push(await tx.insertMovement({ lotId: s.lot.id, itemId: s.lot.itemId, movementType: input.type, quantityDelta: s.delta, balanceAfter: balance, reason: input.reason || null, reference: input.reference || null, actorId }));
    }
    await tx.audit({ actorId, action: `INVENTORY_${input.type.toUpperCase()}`, entityType: 'inventory_lot', entityId: steps[0].lot.id, details: { type: input.type, lots: steps.map(s => ({ lotNumber: s.lot.lotNumber, delta: s.delta, status: s.nextStatus })), reason: input.reason ?? null, reference: input.reference ?? null } });
    return movements;
  });
}
