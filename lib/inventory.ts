// Inventory & reagent lot control (Increment 1.24).
// Pure domain rules: no database, framework or alias imports, so they run under `node --test`.
// Quantities are whole base units (tests, vials, pieces). Dates are calendar dates (YYYY-MM-DD, UTC).

export const ITEM_CATEGORIES = ['Reagent', 'Calibrator', 'Control', 'Consumable', 'Kit'] as const;
export const STORAGE_CONDITIONS = ['Room temperature', '2-8 C', '-20 C', '-80 C'] as const;
export const MOVEMENT_TYPES = ['receive', 'consume', 'adjust', 'discard', 'quarantine', 'release'] as const;
export const LOT_STATUSES = ['Available', 'Quarantined', 'Depleted', 'Discarded'] as const;
export const EXPIRY_WARNING_DAYS = 30;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type LotStatus = (typeof LOT_STATUSES)[number];
export type ExpiryState = 'Expired' | 'Expiring soon' | 'OK';

export type Lot = { id: string; itemId: string; lotNumber: string; expiryDate: string; receivedAt?: string; onHandQty: number; status: LotStatus };
export type Item = { id: string; itemCode: string; name: string; reorderLevel: number; active: boolean };
export type Allocation = { lotId: string; lotNumber: string; quantity: number };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function utcDate(now: Date): string { return now.toISOString().slice(0, 10); }

export function daysUntil(expiryDate: string, now: Date): number {
  if (!isCalendarDate(expiryDate)) throw new Error('Invalid expiry date.');
  const ms = new Date(`${expiryDate}T00:00:00Z`).getTime() - new Date(`${utcDate(now)}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

// A lot is usable through the end of its expiry date and unusable from the next day.
export function expiryState(expiryDate: string, now: Date, warningDays = EXPIRY_WARNING_DAYS): ExpiryState {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return 'Expired';
  return days <= warningDays ? 'Expiring soon' : 'OK';
}

export function isUsable(lot: Pick<Lot, 'status' | 'onHandQty' | 'expiryDate'>, now: Date): boolean {
  return lot.status === 'Available' && lot.onHandQty > 0 && expiryState(lot.expiryDate, now) !== 'Expired';
}

export type Validation = { ok: true; delta: number; nextStatus: LotStatus } | { ok: false; error: string };
const fail = (error: string): Validation => ({ ok: false, error });
const isWhole = (n: number) => Number.isInteger(n) && Number.isSafeInteger(n);

// Validates one movement against one lot and returns the signed quantity change and resulting status.
export function validateMovement(lot: Pick<Lot, 'status' | 'onHandQty' | 'expiryDate'>, type: Exclude<MovementType, 'receive'>, quantity: number, reason: string | undefined, now: Date): Validation {
  const why = (reason ?? '').trim();
  if (!isWhole(quantity)) return fail('Quantity must be a whole number.');
  if (lot.status === 'Discarded') return fail('A discarded lot cannot be changed.');
  switch (type) {
    case 'consume':
      if (quantity <= 0) return fail('Consumed quantity must be greater than zero.');
      if (lot.status === 'Quarantined') return fail('A quarantined lot cannot be consumed.');
      if (expiryState(lot.expiryDate, now) === 'Expired') return fail('An expired lot cannot be consumed.');
      if (quantity > lot.onHandQty) return fail('Quantity exceeds the on-hand balance.');
      return { ok: true, delta: -quantity, nextStatus: lot.onHandQty - quantity === 0 ? 'Depleted' : lot.status };
    case 'discard':
      if (quantity <= 0) return fail('Discarded quantity must be greater than zero.');
      if (why.length < 3) return fail('A reason is required to discard stock.');
      if (quantity > lot.onHandQty) return fail('Quantity exceeds the on-hand balance.');
      return { ok: true, delta: -quantity, nextStatus: lot.onHandQty - quantity === 0 ? 'Discarded' : lot.status };
    case 'adjust': {
      if (quantity === 0) return fail('An adjustment cannot be zero.');
      if (why.length < 3) return fail('A reason is required for a stock adjustment.');
      const after = lot.onHandQty + quantity;
      if (after < 0) return fail('Adjustment would make the balance negative.');
      const next: LotStatus = after === 0 ? 'Depleted' : lot.status === 'Depleted' ? 'Available' : lot.status;
      return { ok: true, delta: quantity, nextStatus: next };
    }
    case 'quarantine':
      if (why.length < 3) return fail('A reason is required to quarantine a lot.');
      if (lot.status !== 'Available') return fail('Only an available lot can be quarantined.');
      return { ok: true, delta: 0, nextStatus: 'Quarantined' };
    case 'release':
      if (why.length < 3) return fail('A reason is required to release a lot from quarantine.');
      if (lot.status !== 'Quarantined') return fail('Only a quarantined lot can be released.');
      if (expiryState(lot.expiryDate, now) === 'Expired') return fail('An expired lot cannot be released from quarantine.');
      return { ok: true, delta: 0, nextStatus: lot.onHandQty > 0 ? 'Available' : 'Depleted' };
  }
}

export type FefoResult = { ok: true; allocations: Allocation[] } | { ok: false; error: string; shortfall: number };

// First-expired-first-out allocation across usable lots. Ties on expiry use the older receipt first.
export function allocateFefo(lots: Lot[], quantity: number, now: Date): FefoResult {
  if (!isWhole(quantity) || quantity <= 0) return { ok: false, error: 'Quantity must be a whole number greater than zero.', shortfall: 0 };
  const usable = lots.filter(l => isUsable(l, now)).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || (a.receivedAt ?? '').localeCompare(b.receivedAt ?? '') || a.lotNumber.localeCompare(b.lotNumber));
  const allocations: Allocation[] = [];
  let remaining = quantity;
  for (const lot of usable) {
    if (remaining === 0) break;
    const take = Math.min(lot.onHandQty, remaining);
    allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) return { ok: false, error: 'Insufficient usable stock (expired, quarantined and depleted lots are excluded).', shortfall: remaining };
  return { ok: true, allocations };
}

export type StockSummary = { usableQty: number; quarantinedQty: number; expiredQty: number; expiringSoonQty: number; nearestUsableExpiry: string | null; belowReorder: boolean; alerts: string[] };

export function summarizeItem(item: Item, lots: Lot[], now: Date): StockSummary {
  let usableQty = 0, quarantinedQty = 0, expiredQty = 0, expiringSoonQty = 0; let nearest: string | null = null;
  for (const lot of lots) {
    if (lot.itemId !== item.id || lot.onHandQty <= 0 || lot.status === 'Discarded') continue;
    const exp = expiryState(lot.expiryDate, now);
    if (exp === 'Expired') { expiredQty += lot.onHandQty; continue; }
    if (lot.status === 'Quarantined') { quarantinedQty += lot.onHandQty; continue; }
    if (lot.status !== 'Available') continue;
    usableQty += lot.onHandQty;
    if (exp === 'Expiring soon') expiringSoonQty += lot.onHandQty;
    if (nearest === null || lot.expiryDate < nearest) nearest = lot.expiryDate;
  }
  const belowReorder = item.active && usableQty <= item.reorderLevel;
  const alerts: string[] = [];
  if (belowReorder) alerts.push(usableQty === 0 ? 'Out of usable stock' : 'Below reorder level');
  if (expiringSoonQty > 0) alerts.push('Stock expiring soon');
  if (expiredQty > 0) alerts.push('Expired stock on hand');
  if (quarantinedQty > 0) alerts.push('Stock in quarantine');
  return { usableQty, quarantinedQty, expiredQty, expiringSoonQty, nearestUsableExpiry: nearest, belowReorder, alerts };
}

// Replays a lot's ledger and checks that every recorded balance matches the running total.
export function verifyLedger(entries: { quantityDelta: number; balanceAfter: number }[]): { ok: boolean; brokenAt: number | null } {
  let running = 0;
  for (let i = 0; i < entries.length; i += 1) {
    running += entries[i].quantityDelta;
    if (running !== entries[i].balanceAfter || running < 0) return { ok: false, brokenAt: i };
  }
  return { ok: true, brokenAt: null };
}
