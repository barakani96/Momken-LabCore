import type { AuditEntry } from '../../core/errors.ts';
import type { NewLine, PoStatus, PurchaseOrder } from './domain.ts';

export type CatalogItem = { id: string; itemCode: string; name: string; active: boolean };
export type StockReceiptInput = { itemId: string; lotNumber: string; expiryDate: string; quantity: number; storageLocation?: string; reference?: string; quarantineOnReceipt?: boolean };
export interface ProcurementTx {
  nextOrderNumber(year: number): Promise<string>;
  findItems(ids: string[]): Promise<CatalogItem[]>;
  insertOrder(order: { poNumber: string; supplier: string; currency: string; createdBy: string; lines: NewLine[] }): Promise<PurchaseOrder>;
  lockOrder(id: string): Promise<PurchaseOrder | null>;
  setOrderStatus(id: string, status: PoStatus, approvedBy?: string): Promise<void>;
  setLineReceived(lineId: string, receivedQty: number): Promise<void>;
  // Inventory module's public capability, provided by the composition root inside the same transaction.
  receiveStock(actorId: string, input: StockReceiptInput): Promise<{ lotId: string; movementId: number }>;
  insertReceipt(r: { lineId: string; lotId: string; movementId: number; quantity: number; receivedBy: string }): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}
export interface ProcurementUnitOfWork { run<T>(work: (tx: ProcurementTx) => Promise<T>): Promise<T> }
