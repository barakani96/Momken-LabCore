// Procurement domain rules (Increment 1.25). Pure: no framework or database imports.
// Money is held as integer minor units (for example cents) with an ISO-4217 currency code.
export const PO_STATUSES = ['Draft', 'Approved', 'Partially received', 'Received', 'Cancelled'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export type PoLine = { id: string; itemId: string; orderedQty: number; receivedQty: number; unitPriceMinor: number };
export type PurchaseOrder = { id: string; poNumber: string; supplier: string; currency: string; status: PoStatus; createdBy: string; approvedBy: string | null; lines: PoLine[] };
export type NewLine = { itemId: string; orderedQty: number; unitPriceMinor: number };

const CURRENCY_RE = /^[A-Z]{3}$/;
export function validateNewOrder(input: { supplier: string; currency: string; lines: NewLine[] }): string | null {
  if (input.supplier.trim().length < 2) return 'Supplier is required.';
  if (!CURRENCY_RE.test(input.currency)) return 'Currency must be a three-letter ISO code.';
  if (input.lines.length === 0) return 'An order needs at least one line.';
  if (input.lines.length > 100) return 'An order cannot exceed 100 lines.';
  const seen = new Set<string>();
  for (const l of input.lines) {
    if (seen.has(l.itemId)) return 'An item can appear only once per order.';
    seen.add(l.itemId);
    if (!Number.isInteger(l.orderedQty) || l.orderedQty < 1) return 'Ordered quantities must be whole numbers of at least 1.';
    if (!Number.isInteger(l.unitPriceMinor) || l.unitPriceMinor < 0) return 'Unit prices must be zero or more.';
  }
  return null;
}
export const orderTotalMinor = (lines: Pick<PoLine, 'orderedQty' | 'unitPriceMinor'>[]) => lines.reduce((sum, l) => sum + l.orderedQty * l.unitPriceMinor, 0);
export const outstandingQty = (l: Pick<PoLine, 'orderedQty' | 'receivedQty'>) => l.orderedQty - l.receivedQty;

export type Check = { ok: true } | { ok: false; error: string };
const no = (error: string): Check => ({ ok: false, error });
// Separation of duties: the person who raised an order cannot approve it.
export function canApprove(po: Pick<PurchaseOrder, 'status' | 'createdBy'>, actorId: string): Check {
  if (po.status !== 'Draft') return no('Only a draft order can be approved.');
  if (po.createdBy === actorId) return no('The author of an order cannot approve it.');
  return { ok: true };
}
export function canCancel(po: Pick<PurchaseOrder, 'status' | 'lines'>): Check {
  if (po.status === 'Cancelled') return no('The order is already cancelled.');
  if (po.status === 'Received') return no('A fully received order cannot be cancelled.');
  if (po.lines.some(l => l.receivedQty > 0)) return no('An order with receipts cannot be cancelled.');
  return { ok: true };
}
export function canReceive(po: Pick<PurchaseOrder, 'status' | 'lines'>, lineId: string, qty: number): Check {
  if (po.status !== 'Approved' && po.status !== 'Partially received') return no('Stock can only be received against an approved order.');
  const line = po.lines.find(l => l.id === lineId);
  if (!line) return no('Order line not found.');
  if (!Number.isInteger(qty) || qty < 1) return no('Received quantity must be a whole number of at least 1.');
  if (qty > outstandingQty(line)) return no('Received quantity exceeds the outstanding quantity on the line.');
  return { ok: true };
}
export function statusAfterReceipt(lines: Pick<PoLine, 'orderedQty' | 'receivedQty'>[]): PoStatus {
  return lines.every(l => l.receivedQty >= l.orderedQty) ? 'Received' : 'Partially received';
}
