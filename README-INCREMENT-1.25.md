# Increment 1.25 — Clean architecture, Procurement, shared Carbon UI kit

## Architecture (new modules follow this; older modules are not yet migrated)
```
app/api/**/route.ts      Interface: auth, zod parsing, permission checks, HTTP mapping only
modules/<m>/use-cases.ts Application: one function per use case, runs inside a unit of work
modules/<m>/ports.ts     Application-owned persistence interfaces (UnitOfWork + Tx)
lib/inventory.ts, modules/procurement/domain.ts   Domain: pure rules, no imports
modules/<m>/drizzle-repository.ts  Infrastructure: Drizzle implementation of the ports + read queries
core/                    AppError (kind → HTTP status), Clock, audit entry type, error→response helper
tests/support/memory-store.ts      In-memory ports with rollback, for behavioural tests
```
Dependency direction: routes → use cases → domain; infrastructure implements ports. A test (`clean-architecture.node.test.mjs`) fails if domain or application files import Next, React, Drizzle, `pg`, `@/` or an adapter, if the procurement application imports the inventory module, or if a route touches the schema or transactions.

Procurement receives stock through its own port (`receiveStock`). Only the composition root (`modules/procurement/drizzle-repository.ts`) connects it to `receiveLotInTx` from inventory, inside the same database transaction, so a failed lot receipt rolls back the order receipt.

Inventory (1.24) was refactored into this structure with no change to its API.

## Procurement
- Purchase orders with lines, currency (integer minor units) and an order number from a database sequence (`PO-2026-000001`).
- Draft → Approved → Partially received → Received, or Cancelled.
- Separation of duties: the author cannot approve (use case and a database CHECK).
- Receiving per line creates an inventory lot and an append-only receipt linking line, lot and ledger movement. Over-receipt is blocked (use case and CHECK). Cancelling needs a reason and is blocked once anything is received.
- Routes: `GET/POST /api/procurement/orders`, `PATCH /api/procurement/orders/:id` (`approve`, `cancel`), `POST /api/procurement/orders/:id/receipts`.
- Permissions (new): `procurement.read|manage|approve|receive`; Admin and Lab Manager receive all four. Adjust per role in user administration.
- Migration `0022_procurement_purchase_orders.sql` (journal index 21).

## UX / Carbon
- Shared kit in `components/ui`: `PageHeader` (Carbon `Breadcrumb` + productive heading + actions), `KpiTile`/`KpiGrid` (Carbon `Tile` with a warning/error accent), `StatusTag` (one status vocabulary → one Carbon tag colour, English and Arabic), `Ltr` (bidi isolation).
- Procurement screen: `DataTable` with expandable rows, `ContentSwitcher` status filter, search, pagination, `ProgressBar` per line, skeleton loading, create/receive/cancel modals with inline validation (duplicate item, invalid amount, over-receipt), money formatted per currency.
- Inventory screen now uses the same kit, and shows an `ActionableNotification` when items are at or below reorder level, with a shortcut to procurement.
- `lib/money.ts`: exact string-based amount parsing and per-currency formatting (JPY 0, USD 2, KWD 3 decimals).

## Verification — what was and was not done
- `npm test`: 144 tests pass. The use cases are exercised through the in-memory ports: FEFO across lots, rollback on shortage, duplicate/expired lots, quarantine and release, the full PO lifecycle, separation of duties, partial receipts, over-receipt, and rollback of an order receipt when the inventory lot is rejected. Money parsing/formatting is tested.
- Not done (no `node_modules`, network or PostgreSQL here): `next build`, full type check (only syntax and the pure layers were checked), lint, running migrations 0021/0022, exercising the Drizzle adapters and `FOR UPDATE` locking under concurrency, rendering either screen, RTL/visual checks, or checking the Carbon prop usage against the installed version. The Drizzle adapters and both workbenches are the least-verified parts. Run `npm install && npm run build && npm run lint`, migrate a scratch database, then click through `/inventory` and `/procurement` in English and Arabic.
- The UI does not yet know the signed-in user's permissions, so buttons such as Approve are shown to everyone and the API answers 403 (or the author rule) with a message. Hiding them by permission is a follow-up.
- Not covered: prices flowing into finance, supplier master data, goods-return, backorders, and refactoring the older laboratory modules into this structure.
