import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allocateFefo, daysUntil, expiryState, isCalendarDate, isUsable, summarizeItem, validateMovement, verifyLedger } from '../lib/inventory.ts';
const read = p => readFile(new URL(p, import.meta.url), 'utf8');
const NOW = new Date('2026-10-21T09:30:00Z');
const lot = (o = {}) => ({ id: 'l1', itemId: 'i1', lotNumber: 'A1', expiryDate: '2027-03-01', receivedAt: '2026-09-01T00:00:00Z', onHandQty: 100, status: 'Available', ...o });
const item = (o = {}) => ({ id: 'i1', itemCode: 'ALT-R1', name: 'ALT reagent', reorderLevel: 50, active: true, ...o });

test('calendar dates are validated strictly', () => {
  assert.equal(isCalendarDate('2026-02-28'), true);
  for (const bad of ['2026-02-30', '2026-13-01', '26-01-01', '2026-1-1', '', 'tomorrow']) assert.equal(isCalendarDate(bad), false, bad);
  assert.throws(() => daysUntil('2026-02-30', NOW));
});

test('a lot is usable through its expiry date and expired from the next day', () => {
  assert.equal(expiryState('2026-10-21', NOW), 'Expiring soon');
  assert.equal(expiryState('2026-10-20', NOW), 'Expired');
  assert.equal(expiryState('2026-11-20', NOW), 'Expiring soon');
  assert.equal(expiryState('2026-11-21', NOW), 'OK');
  assert.equal(daysUntil('2026-10-22', new Date('2026-10-21T23:59:59Z')), 1);
  assert.equal(isUsable(lot({ expiryDate: '2026-10-21' }), NOW), true);
  assert.equal(isUsable(lot({ expiryDate: '2026-10-20' }), NOW), false);
  assert.equal(isUsable(lot({ status: 'Quarantined' }), NOW), false);
  assert.equal(isUsable(lot({ onHandQty: 0 }), NOW), false);
});

test('consumption validates quantity, status, expiry and balance', () => {
  assert.deepEqual(validateMovement(lot(), 'consume', 40, undefined, NOW), { ok: true, delta: -40, nextStatus: 'Available' });
  assert.deepEqual(validateMovement(lot(), 'consume', 100, undefined, NOW), { ok: true, delta: -100, nextStatus: 'Depleted' });
  for (const [l, q, re] of [[lot(), 101, /exceeds/], [lot(), 0, /greater than zero/], [lot(), -5, /greater than zero/], [lot(), 1.5, /whole/], [lot({ status: 'Quarantined' }), 1, /quarantined/], [lot({ expiryDate: '2026-10-20' }), 1, /expired/], [lot({ status: 'Discarded' }), 1, /discarded/]]) {
    const r = validateMovement(l, 'consume', q, undefined, NOW); assert.equal(r.ok, false); assert.match(r.error, re);
  }
});

test('discard, adjust, quarantine and release require reasons and legal states', () => {
  assert.equal(validateMovement(lot(), 'discard', 10, '', NOW).ok, false);
  assert.deepEqual(validateMovement(lot({ onHandQty: 10 }), 'discard', 10, 'Dropped tray', NOW), { ok: true, delta: -10, nextStatus: 'Discarded' });
  assert.equal(validateMovement(lot(), 'adjust', 0, 'recount', NOW).ok, false);
  assert.equal(validateMovement(lot(), 'adjust', -101, 'recount', NOW).ok, false);
  assert.equal(validateMovement(lot(), 'adjust', -5, 'x', NOW).ok, false);
  assert.deepEqual(validateMovement(lot(), 'adjust', -5, 'Recount variance', NOW), { ok: true, delta: -5, nextStatus: 'Available' });
  assert.deepEqual(validateMovement(lot({ onHandQty: 0, status: 'Depleted' }), 'adjust', 12, 'Found stock on shelf', NOW), { ok: true, delta: 12, nextStatus: 'Available' });
  assert.deepEqual(validateMovement(lot(), 'quarantine', 0, 'QC shift on new lot', NOW), { ok: true, delta: 0, nextStatus: 'Quarantined' });
  assert.equal(validateMovement(lot({ status: 'Quarantined' }), 'quarantine', 0, 'again', NOW).ok, false);
  assert.deepEqual(validateMovement(lot({ status: 'Quarantined' }), 'release', 0, 'QC acceptable', NOW), { ok: true, delta: 0, nextStatus: 'Available' });
  assert.equal(validateMovement(lot(), 'release', 0, 'not held', NOW).ok, false);
  assert.match(validateMovement(lot({ status: 'Quarantined', expiryDate: '2026-10-01' }), 'release', 0, 'late', NOW).error, /expired/);
});

test('FEFO allocates earliest expiry first across lots and skips unusable lots', () => {
  const lots = [
    lot({ id: 'late', lotNumber: 'L3', expiryDate: '2027-06-01', onHandQty: 100 }),
    lot({ id: 'soon', lotNumber: 'L1', expiryDate: '2026-12-01', onHandQty: 30 }),
    lot({ id: 'held', lotNumber: 'L0', expiryDate: '2026-11-01', onHandQty: 500, status: 'Quarantined' }),
    lot({ id: 'dead', lotNumber: 'LX', expiryDate: '2026-10-01', onHandQty: 500 }),
    lot({ id: 'mid', lotNumber: 'L2', expiryDate: '2027-02-01', onHandQty: 50 })
  ];
  const r = allocateFefo(lots, 100, NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.allocations.map(a => [a.lotId, a.quantity]), [['soon', 30], ['mid', 50], ['late', 20]]);
  const tooMuch = allocateFefo(lots, 181, NOW);
  assert.equal(tooMuch.ok, false); assert.equal(tooMuch.shortfall, 1);
  assert.equal(allocateFefo(lots, 0, NOW).ok, false);
});

test('FEFO breaks expiry ties by earlier receipt and does not mutate its input', () => {
  const lots = [lot({ id: 'b', lotNumber: 'B', receivedAt: '2026-09-10T00:00:00Z', onHandQty: 5 }), lot({ id: 'a', lotNumber: 'A', receivedAt: '2026-09-01T00:00:00Z', onHandQty: 5 })];
  const snapshot = JSON.stringify(lots);
  assert.deepEqual(allocateFefo(lots, 7, NOW).allocations.map(a => [a.lotId, a.quantity]), [['a', 5], ['b', 2]]);
  assert.equal(JSON.stringify(lots), snapshot);
});

test('stock summary excludes expired and quarantined stock from usable counts and raises alerts', () => {
  const lots = [lot({ id: '1', onHandQty: 20, expiryDate: '2026-11-05' }), lot({ id: '2', onHandQty: 25, expiryDate: '2027-05-01' }), lot({ id: '3', onHandQty: 40, status: 'Quarantined' }), lot({ id: '4', onHandQty: 9, expiryDate: '2026-10-01' }), lot({ id: '5', itemId: 'other', onHandQty: 999 }), lot({ id: '6', status: 'Discarded', onHandQty: 0 })];
  const s = summarizeItem(item(), lots, NOW);
  assert.equal(s.usableQty, 45); assert.equal(s.quarantinedQty, 40); assert.equal(s.expiredQty, 9); assert.equal(s.expiringSoonQty, 20);
  assert.equal(s.nearestUsableExpiry, '2026-11-05'); assert.equal(s.belowReorder, true);
  assert.deepEqual(s.alerts, ['Below reorder level', 'Stock expiring soon', 'Expired stock on hand', 'Stock in quarantine']);
  assert.equal(summarizeItem(item({ reorderLevel: 44 }), lots, NOW).belowReorder, false);
  assert.equal(summarizeItem(item({ active: false }), [], NOW).belowReorder, false);
  assert.deepEqual(summarizeItem(item(), [], NOW).alerts, ['Out of usable stock']);
});

test('ledger verification detects a tampered or negative running balance', () => {
  assert.deepEqual(verifyLedger([{ quantityDelta: 100, balanceAfter: 100 }, { quantityDelta: -30, balanceAfter: 70 }, { quantityDelta: 0, balanceAfter: 70 }]), { ok: true, brokenAt: null });
  assert.deepEqual(verifyLedger([{ quantityDelta: 100, balanceAfter: 100 }, { quantityDelta: -30, balanceAfter: 80 }]), { ok: false, brokenAt: 1 });
  assert.equal(verifyLedger([{ quantityDelta: -1, balanceAfter: -1 }]).ok, false);
});

test('inventory migration enforces ledger immutability, reasons and unique lots', async () => {
  const sql = await read('../db/migrations/0021_inventory_reagent_control.sql');
  for (const t of ['inventory_items', 'inventory_lots', 'inventory_movements']) assert.match(sql, new RegExp(`CREATE TABLE ${t}`));
  assert.match(sql, /CREATE UNIQUE INDEX inventory_lots_item_lot_unique_idx ON inventory_lots\(item_id, lot_number\)/);
  assert.match(sql, /on_hand_qty integer NOT NULL CHECK \(on_hand_qty >= 0\)/);
  assert.match(sql, /inventory movements are append-only/); assert.match(sql, /BEFORE UPDATE OR DELETE ON inventory_movements/);
  assert.match(sql, /inventory lot identity is immutable/); assert.match(sql, /inventory_movements_reason_required/); assert.match(sql, /inventory_movements_delta_sign/);
  const j = JSON.parse(await read('../db/migrations/meta/_journal.json'));
  assert.equal(j.entries.find(e => e.tag === '0021_inventory_reagent_control')?.idx, 20);
  assert.equal(new Set(j.entries.map(e => e.idx)).size, j.entries.length);
});

test('inventory persistence adapter locks lots and routes enforce split permissions', async () => {
  const repo = await read('../modules/inventory/drizzle-repository.ts'); const uc = await read('../modules/inventory/use-cases.ts');
  const mv = await read('../app/api/inventory/movements/route.ts'); const lots = await read('../app/api/inventory/lots/route.ts'); const items = await read('../app/api/inventory/items/route.ts');
  assert.match(repo, /\.for\('update'\)/); assert.match(repo, /db\.transaction/); assert.match(repo, /23505/);
  assert.match(uc, /allocateFefo/); assert.match(uc, /validateMovement/); assert.match(uc, /INVENTORY_LOT_RECEIVED/); assert.match(uc, /already expired/);
  assert.match(mv, /inventory\.consume/); assert.match(mv, /inventory\.manage/); assert.match(lots, /inventory\.manage/); assert.match(items, /inventory\.read/); assert.match(items, /inventory\.manage/);
});

test('inventory permissions, navigation and Carbon workbench are registered', async () => {
  const p = await read('../lib/auth/permissions.ts'); const nav = await read('../components/app-shell.tsx'); const page = await read('../app/inventory/page.tsx'); const ui = await read('../components/inventory-workbench.tsx');
  assert.match(p, /'inventory\.consume'/); assert.match(nav, /href="\/inventory"/); assert.match(page, /InventoryWorkbench/);
  for (const c of ['DataTable', 'TableExpandRow', 'TableToolbarSearch', 'Pagination', 'Tabs', 'Tile', 'Modal', 'DataTableSkeleton', 'InlineNotification']) assert.match(ui, new RegExp(`\\b${c}\\b`), c);
  assert.doesNotMatch(ui, /from 'react-bootstrap'|from '@mui|from 'antd'/);
  for (const s of ['Receive lot', 'Stock ledger', 'المخزون وضبط الكواشف', 'استلام دفعة']) assert.ok(ui.includes(s), s);
  assert.match(ui, /<Ltr>/); assert.match(await read('../components/ui/bidi.tsx'), /dir="ltr"/);
  assert.match(ui, /PageHeader/); assert.match(ui, /KpiTile/); assert.match(ui, /StatusTag/);
});
