import type { AuditEntry } from '../../core/errors.ts';
import type { LotStatus, MovementType } from '../../lib/inventory.ts';

export type ItemRecord = { id: string; itemCode: string; name: string; category: string; unit: string; storageCondition: string; reorderLevel: number; supplier: string | null; active: boolean };
export type NewItem = Omit<ItemRecord, 'id' | 'active'>;
export type LotRecord = { id: string; itemId: string; lotNumber: string; expiryDate: string; receivedQty: number; onHandQty: number; status: LotStatus; storageLocation: string | null; receivedAt: Date };
export type NewLot = { itemId: string; lotNumber: string; expiryDate: string; quantity: number; status: LotStatus; storageLocation: string | null; receivedBy: string };
export type MovementRecord = { id: number; lotId: string; itemId: string; movementType: MovementType; quantityDelta: number; balanceAfter: number; reason: string | null; reference: string | null; actorId: string };
export type NewMovement = Omit<MovementRecord, 'id'>;

// Persistence port used inside a transaction. Implementations must lock rows returned by the lock* methods.
export interface InventoryTx {
  getItem(id: string): Promise<ItemRecord | null>;
  insertItem(item: NewItem, createdBy: string): Promise<ItemRecord>; // throws AppError('conflict') on a duplicate item code
  lockLotById(id: string): Promise<LotRecord | null>;
  lockAvailableLotsForItem(itemId: string): Promise<LotRecord[]>;
  insertLot(lot: NewLot): Promise<LotRecord>; // throws AppError('conflict') when the lot number already exists for the item
  updateLot(id: string, patch: { onHandQty: number; status: LotStatus }, at: Date): Promise<void>;
  insertMovement(movement: NewMovement): Promise<MovementRecord>;
  audit(entry: AuditEntry): Promise<void>;
}
export interface InventoryUnitOfWork { run<T>(work: (tx: InventoryTx) => Promise<T>): Promise<T> }
