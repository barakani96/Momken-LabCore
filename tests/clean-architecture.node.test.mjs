import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createStore } from './support/memory-store.ts';
import { createItem, receiveLot, recordMovement } from '../modules/inventory/use-cases.ts';
import { approveOrder, cancelOrder, createOrder, receiveAgainstOrder } from '../modules/procurement/use-cases.ts';
import { canApprove, canCancel, canReceive, orderTotalMinor, statusAfterReceipt, validateNewOrder } from '../modules/procurement/domain.ts';

const USER = 'user-a', BOSS = 'user-b';
const newItem = (o = {}) => ({ itemCode: 'ALT-R1', name: 'ALT reagent', category: 'Reagent', unit: 'tests', storageCondition: '2-8 C', reorderLevel: 100, supplier: null, ...o });
async function seeded() { const st = createStore(); const item = await createItem(st.inventoryUow, USER, newItem()); return { st, item }; }
const rejects = (p, kind, re) => assert.rejects(p, e => e.name === 'AppError' && e.kind === kind && re.test(e.message));

test('receiveLot creates lot, receive movement and audit atomically; duplicates and expired lots are rejected', async () => {
  const { st, item } = await seeded();
  const { lot, movement } = await receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: 'L1', expiryDate: '2027-01-31', quantity: 200 });
  assert.equal(lot.onHandQty, 200); assert.equal(movement.balanceAfter, 200); assert.equal(st.state.audits.at(-1).action, 'INVENTORY_LOT_RECEIVED');
  await rejects(receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: 'L1', expiryDate: '2027-01-31', quantity: 5 }), 'conflict', /already registered/);
  await rejects(receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: 'L2', expiryDate: '2026-10-20', quantity: 5 }), 'rule', /expired/);
  await rejects(receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: 'L3', expiryDate: '2026-02-30', quantity: 5 }), 'validation', /valid date/);
  await rejects(receiveLot(st.inventoryUow, st.clock, USER, { itemId: 'missing', lotNumber: 'L4', expiryDate: '2027-01-31', quantity: 5 }), 'not_found', /not found/);
  assert.equal(st.state.lots.length, 1);
});

test('FEFO consumption spans lots, keeps balances consistent and rolls back entirely on shortage', async () => {
  const { st, item } = await seeded();
  for (const [n, d, q] of [['LATE', '2027-06-01', 100], ['SOON', '2026-12-01', 30], ['MID', '2027-02-01', 50]]) await receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: n, expiryDate: d, quantity: q });
  const moves = await recordMovement(st.inventoryUow, st.clock, USER, { type: 'consume', itemId: item.id, quantity: 100, reference: 'RUN-1' });
  assert.deepEqual(moves.map(m => [st.state.lots.find(l => l.id === m.lotId).lotNumber, m.quantityDelta, m.balanceAfter]), [['SOON', -30, 0], ['MID', -50, 0], ['LATE', -20, 80]]);
  assert.equal(st.state.lots.find(l => l.lotNumber === 'SOON').status, 'Depleted');
  const before = JSON.stringify(st.state.lots), movementCount = st.state.movements.length, auditCount = st.state.audits.length;
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'consume', itemId: item.id, quantity: 81 }), 'rule', /Insufficient usable stock/);
  assert.equal(JSON.stringify(st.state.lots), before); assert.equal(st.state.movements.length, movementCount); assert.equal(st.state.audits.length, auditCount);
});

test('recordMovement enforces lot rules and argument shape', async () => {
  const { st, item } = await seeded();
  const { lot } = await receiveLot(st.inventoryUow, st.clock, USER, { itemId: item.id, lotNumber: 'L1', expiryDate: '2027-01-31', quantity: 10 });
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'discard', lotId: lot.id, quantity: 3 }), 'rule', /reason/);
  await recordMovement(st.inventoryUow, st.clock, USER, { type: 'quarantine', lotId: lot.id, quantity: 0, reason: 'QC drift' });
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'consume', lotId: lot.id, quantity: 1 }), 'rule', /quarantined/);
  await recordMovement(st.inventoryUow, st.clock, USER, { type: 'release', lotId: lot.id, quantity: 0, reason: 'QC acceptable' });
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'adjust', itemId: item.id, quantity: 1, reason: 'x y z' }), 'validation', /specific lot/);
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'consume', quantity: 1 }), 'validation', /Provide a lot/);
  await rejects(recordMovement(st.inventoryUow, st.clock, USER, { type: 'consume', lotId: 'nope', quantity: 1 }), 'not_found', /Lot not found/);
  assert.equal(st.state.movements.every((m, i, a) => a.slice(0, i + 1).filter(x => x.lotId === m.lotId).reduce((t, x) => t + x.quantityDelta, 0) === m.balanceAfter), true);
});

test('procurement domain rules: validation, separation of duties, receipt limits and status derivation', () => {
  const line = { itemId: 'i1', orderedQty: 10, unitPriceMinor: 1250 };
  assert.equal(validateNewOrder({ supplier: 'Acme', currency: 'USD', lines: [line] }), null);
  for (const [o, re] of [[{ supplier: 'A', currency: 'USD', lines: [line] }, /Supplier/], [{ supplier: 'Acme', currency: 'usd', lines: [line] }, /Currency/], [{ supplier: 'Acme', currency: 'USD', lines: [] }, /at least one/], [{ supplier: 'Acme', currency: 'USD', lines: [line, line] }, /only once/], [{ supplier: 'Acme', currency: 'USD', lines: [{ ...line, orderedQty: 0 }] }, /whole numbers/], [{ supplier: 'Acme', currency: 'USD', lines: [{ ...line, unitPriceMinor: -1 }] }, /zero or more/]]) assert.match(validateNewOrder(o), re);
  assert.equal(orderTotalMinor([{ orderedQty: 10, unitPriceMinor: 1250 }, { orderedQty: 3, unitPriceMinor: 99 }]), 12797);
  assert.equal(canApprove({ status: 'Draft', createdBy: 'a' }, 'a').ok, false); assert.equal(canApprove({ status: 'Draft', createdBy: 'a' }, 'b').ok, true); assert.equal(canApprove({ status: 'Approved', createdBy: 'a' }, 'b').ok, false);
  const po = { status: 'Approved', lines: [{ id: 'l1', orderedQty: 10, receivedQty: 4 }] };
  assert.equal(canReceive(po, 'l1', 6).ok, true); assert.equal(canReceive(po, 'l1', 7).ok, false); assert.equal(canReceive(po, 'l9', 1).ok, false); assert.equal(canReceive({ ...po, status: 'Draft' }, 'l1', 1).ok, false);
  assert.equal(canCancel(po).ok, false); assert.equal(canCancel({ status: 'Draft', lines: [{ id: 'l1', orderedQty: 10, receivedQty: 0 }] }).ok, true);
  assert.equal(statusAfterReceipt([{ orderedQty: 5, receivedQty: 5 }, { orderedQty: 5, receivedQty: 2 }]), 'Partially received'); assert.equal(statusAfterReceipt([{ orderedQty: 5, receivedQty: 5 }]), 'Received');
});

test('purchase order lifecycle: create, approve by a second person, receive in parts into inventory lots', async () => {
  const { st, item } = await seeded();
  const po = await createOrder(st.procurementUow, st.clock, USER, { supplier: 'Demo Diagnostics Co.', currency: 'USD', lines: [{ itemId: item.id, orderedQty: 500, unitPriceMinor: 2000 }] });
  assert.match(po.poNumber, /^PO-2026-000001$/); assert.equal(po.status, 'Draft');
  await rejects(receiveAgainstOrder(st.procurementUow, USER, po.id, { lineId: po.lines[0].id, lotNumber: 'X', expiryDate: '2027-05-01', quantity: 1 }), 'rule', /approved order/);
  await rejects(approveOrder(st.procurementUow, USER, po.id), 'rule', /author/);
  await approveOrder(st.procurementUow, BOSS, po.id);
  assert.equal(await receiveAgainstOrder(st.procurementUow, USER, po.id, { lineId: po.lines[0].id, lotNumber: 'P1', expiryDate: '2027-05-01', quantity: 200, storageLocation: 'Fridge 2' }), 'Partially received');
  const lot = st.state.lots.find(l => l.lotNumber === 'P1');
  assert.equal(lot.onHandQty, 200); assert.equal(st.state.movements.find(m => m.lotId === lot.id).reference, po.poNumber); assert.equal(st.state.receipts.length, 1);
  await rejects(receiveAgainstOrder(st.procurementUow, USER, po.id, { lineId: po.lines[0].id, lotNumber: 'P2', expiryDate: '2027-05-01', quantity: 301 }), 'rule', /exceeds the outstanding/);
  await rejects(cancelOrder(st.procurementUow, BOSS, po.id, 'changed our mind'), 'rule', /receipts/);
  assert.equal(await receiveAgainstOrder(st.procurementUow, USER, po.id, { lineId: po.lines[0].id, lotNumber: 'P2', expiryDate: '2027-06-01', quantity: 300 }), 'Received');
  assert.equal(st.state.orders[0].lines[0].receivedQty, 500);
  assert.deepEqual(st.state.audits.map(a => a.action).filter(a => a.startsWith('PO_')), ['PO_CREATED', 'PO_APPROVED', 'PO_RECEIVED', 'PO_RECEIVED']);
});

test('a failed receipt rolls back the whole order receipt, including the inventory lot', async () => {
  const { st, item } = await seeded();
  const po = await createOrder(st.procurementUow, st.clock, USER, { supplier: 'Demo', currency: 'EUR', lines: [{ itemId: item.id, orderedQty: 10, unitPriceMinor: 1 }] });
  await approveOrder(st.procurementUow, BOSS, po.id);
  await rejects(receiveAgainstOrder(st.procurementUow, USER, po.id, { lineId: po.lines[0].id, lotNumber: 'OLD', expiryDate: '2026-01-01', quantity: 5 }), 'rule', /expired/);
  assert.equal(st.state.lots.length, 0); assert.equal(st.state.receipts.length, 0); assert.equal(st.state.orders[0].lines[0].receivedQty, 0); assert.equal(st.state.orders[0].status, 'Approved');
});

test('cancelling needs a reason and works only before any receipt; inactive and unknown items cannot be ordered', async () => {
  const { st, item } = await seeded();
  const po = await createOrder(st.procurementUow, st.clock, USER, { supplier: 'Demo', currency: 'USD', lines: [{ itemId: item.id, orderedQty: 1, unitPriceMinor: 0 }] });
  await rejects(cancelOrder(st.procurementUow, BOSS, po.id, ' '), 'validation', /reason/);
  await cancelOrder(st.procurementUow, BOSS, po.id, 'Duplicate order'); assert.equal(st.state.orders[0].status, 'Cancelled');
  await rejects(approveOrder(st.procurementUow, BOSS, po.id), 'rule', /draft/);
  await rejects(createOrder(st.procurementUow, st.clock, USER, { supplier: 'Demo', currency: 'USD', lines: [{ itemId: 'ghost', orderedQty: 1, unitPriceMinor: 0 }] }), 'not_found', /does not exist/);
  st.state.items[0].active = false;
  await rejects(createOrder(st.procurementUow, st.clock, USER, { supplier: 'Demo', currency: 'USD', lines: [{ itemId: item.id, orderedQty: 1, unitPriceMinor: 0 }] }), 'rule', /inactive/);
});

test('layering: domain and application code import no framework, database or interface code; routes stay thin', async () => {
  const pure = ['lib/inventory.ts', 'modules/inventory/ports.ts', 'modules/inventory/use-cases.ts', 'modules/procurement/domain.ts', 'modules/procurement/ports.ts', 'modules/procurement/use-cases.ts', 'core/errors.ts'];
  for (const f of pure) { const src = await readFile(new URL(`../${f}`, import.meta.url), 'utf8'); assert.doesNotMatch(src, /from '(next|react|drizzle-orm|pg|@\/|@carbon)/, `${f} must stay framework-free`); assert.doesNotMatch(src, /from '\.\.?\/.*(drizzle-repository|\/app\/)/, f); }
  assert.doesNotMatch(await readFile(new URL('../modules/procurement/use-cases.ts', import.meta.url), 'utf8'), /modules\/inventory/, 'procurement application reaches inventory only through its own port');
  for (const dir of ['inventory/items', 'inventory/lots', 'inventory/movements', 'procurement/orders']) {
    const src = await readFile(new URL(`../app/api/${dir}/route.ts`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /@\/db\/schema|\.transaction\(|\.for\('update'\)/, `${dir} route must delegate persistence`); assert.ok(src.split('\n').length < 40, `${dir} route stays small`);
  }
  const files = (await readdir(new URL('../app/api/procurement/orders', import.meta.url), { recursive: true })).filter(f => f.endsWith('route.ts'));
  assert.equal(files.length, 3);
});

test('procurement migration protects receipts, line terms and author-approver separation', async () => {
  const sql = await readFile(new URL('../db/migrations/0022_procurement_purchase_orders.sql', import.meta.url), 'utf8');
  for (const t of ['purchase_orders', 'purchase_order_lines', 'purchase_order_receipts']) assert.match(sql, new RegExp(`CREATE TABLE ${t}`));
  for (const re of [/purchase_orders_author_not_approver/, /purchase_order_lines_no_over_receipt/, /purchase order receipts are append-only/, /purchase order line terms are immutable/, /received quantity cannot decrease/, /CREATE SEQUENCE purchase_order_number_seq/, /unit_price_minor bigint/]) assert.match(sql, re);
  const j = JSON.parse(await readFile(new URL('../db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  assert.equal(j.entries.find(e => e.tag === '0022_procurement_purchase_orders')?.idx, 21); assert.equal(new Set(j.entries.map(e => e.idx)).size, j.entries.length);
});

test('procurement UI is built from official Carbon components, shared UI kit and bilingual labels', async () => {
  const ui = await readFile(new URL('../components/procurement-workbench.tsx', import.meta.url), 'utf8');
  for (const c of ['DataTable', 'TableExpandRow', 'ContentSwitcher', 'ProgressBar', 'Modal', 'Pagination', 'DataTableSkeleton', 'InlineNotification', 'TableToolbarSearch']) assert.match(ui, new RegExp(`\\b${c}\\b`), c);
  for (const s of ['PageHeader', 'KpiTile', 'StatusTag', 'Ltr']) assert.match(ui, new RegExp(s));
  for (const s of ['أمر شراء جديد', 'اعتماد', 'استلام', 'إلغاء الأمر']) assert.ok(ui.includes(s), s);
  assert.doesNotMatch(ui, /from 'react-bootstrap'|from '@mui|from 'antd'/);
  assert.match(await readFile(new URL('../components/ui/page-header.tsx', import.meta.url), 'utf8'), /Breadcrumb/);
  assert.match(await readFile(new URL('../app/procurement/page.tsx', import.meta.url), 'utf8'), /ProcurementWorkbench/);
  const p = await readFile(new URL('../lib/auth/permissions.ts', import.meta.url), 'utf8'); for (const k of ['read', 'manage', 'approve', 'receive']) assert.match(p, new RegExp(`'procurement\\.${k}'`));
});
