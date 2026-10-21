import { AppError, type Clock } from '../../core/errors.ts';
import { canApprove, canCancel, canReceive, orderTotalMinor, statusAfterReceipt, validateNewOrder, type NewLine, type PurchaseOrder } from './domain.ts';
import type { ProcurementUnitOfWork, StockReceiptInput } from './ports.ts';

export async function createOrder(uow: ProcurementUnitOfWork, clock: Clock, actorId: string, input: { supplier: string; currency: string; lines: NewLine[] }): Promise<PurchaseOrder> {
  const problem = validateNewOrder(input);
  if (problem) throw new AppError('validation', problem);
  return uow.run(async tx => {
    const items = await tx.findItems(input.lines.map(l => l.itemId));
    for (const l of input.lines) {
      const item = items.find(i => i.id === l.itemId);
      if (!item) throw new AppError('not_found', 'An ordered item does not exist.');
      if (!item.active) throw new AppError('rule', `Item ${item.itemCode} is inactive and cannot be ordered.`);
    }
    const poNumber = await tx.nextOrderNumber(clock.now().getUTCFullYear());
    const po = await tx.insertOrder({ poNumber, supplier: input.supplier.trim(), currency: input.currency, createdBy: actorId, lines: input.lines });
    await tx.audit({ actorId, action: 'PO_CREATED', entityType: 'purchase_order', entityId: po.id, details: { poNumber, supplier: po.supplier, currency: po.currency, lines: po.lines.length, totalMinor: orderTotalMinor(po.lines) } });
    return po;
  });
}

export async function approveOrder(uow: ProcurementUnitOfWork, actorId: string, orderId: string): Promise<void> {
  await uow.run(async tx => {
    const po = await tx.lockOrder(orderId);
    if (!po) throw new AppError('not_found', 'Purchase order not found.');
    const check = canApprove(po, actorId);
    if (!check.ok) throw new AppError('rule', check.error);
    await tx.setOrderStatus(po.id, 'Approved', actorId);
    await tx.audit({ actorId, action: 'PO_APPROVED', entityType: 'purchase_order', entityId: po.id, details: { poNumber: po.poNumber } });
  });
}

export async function cancelOrder(uow: ProcurementUnitOfWork, actorId: string, orderId: string, reason: string): Promise<void> {
  if (reason.trim().length < 3) throw new AppError('validation', 'A reason is required to cancel an order.');
  await uow.run(async tx => {
    const po = await tx.lockOrder(orderId);
    if (!po) throw new AppError('not_found', 'Purchase order not found.');
    const check = canCancel(po);
    if (!check.ok) throw new AppError('rule', check.error);
    await tx.setOrderStatus(po.id, 'Cancelled');
    await tx.audit({ actorId, action: 'PO_CANCELLED', entityType: 'purchase_order', entityId: po.id, details: { poNumber: po.poNumber, reason: reason.trim() } });
  });
}

export type ReceiveInput = Omit<StockReceiptInput, 'itemId' | 'quantity'> & { lineId: string; quantity: number };

// Receives stock against one order line: creates the inventory lot, links the receipt and advances the order, all in one transaction.
export async function receiveAgainstOrder(uow: ProcurementUnitOfWork, actorId: string, orderId: string, input: ReceiveInput): Promise<PurchaseOrder['status']> {
  return uow.run(async tx => {
    const po = await tx.lockOrder(orderId);
    if (!po) throw new AppError('not_found', 'Purchase order not found.');
    const check = canReceive(po, input.lineId, input.quantity);
    if (!check.ok) throw new AppError('rule', check.error);
    const line = po.lines.find(l => l.id === input.lineId)!;
    const { lineId, ...stock } = input;
    const { lotId, movementId } = await tx.receiveStock(actorId, { ...stock, itemId: line.itemId, reference: input.reference || po.poNumber });
    await tx.insertReceipt({ lineId, lotId, movementId, quantity: input.quantity, receivedBy: actorId });
    const receivedQty = line.receivedQty + input.quantity;
    await tx.setLineReceived(line.id, receivedQty);
    const lines = po.lines.map(l => (l.id === line.id ? { ...l, receivedQty } : l));
    const status = statusAfterReceipt(lines);
    await tx.setOrderStatus(po.id, status);
    await tx.audit({ actorId, action: 'PO_RECEIVED', entityType: 'purchase_order', entityId: po.id, details: { poNumber: po.poNumber, lineId, quantity: input.quantity, lotNumber: input.lotNumber, status } });
    return status;
  });
}
