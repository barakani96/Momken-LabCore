# Increment 1.24 — Inventory & Reagent Lot Control (first ERP core module)

Replaces the `/inventory` placeholder with a working module. It is the first ERP-side module built on the laboratory platform.

## Features
- Item master: reagents, calibrators, controls, consumables and kits, with unit, storage condition, supplier and reorder level.
- Lot receipt with lot number, expiry date, quantity, location, delivery reference, and optional hold in quarantine on receipt. Expired lots cannot be received; a lot number is unique per item.
- Consumption by specific lot, or by item using first-expired-first-out (FEFO) allocation across lots. Expired, quarantined, depleted and discarded lots are never allocated.
- Adjust (signed, reason required), discard (reason required), quarantine and release (reason required; an expired lot cannot be released).
- Append-only stock ledger with a running balance after every movement; corrections are new adjustment entries.
- Stock position per item: usable, quarantined, expired and expiring-soon quantities, nearest usable expiry, reorder and expiry alerts.
- Carbon UI: KPI tiles, tabs (Stock, Lots, Stock ledger), `DataTable` with expandable rows, toolbar search, pagination, skeleton loading, modals, inline notifications, CSV export. English and Arabic with codes, lot numbers, dates and quantities isolated left-to-right.

## Rules worth knowing
- A lot is usable through the end of its expiry date (UTC calendar date) and unusable from the next day. "Expiring soon" means 30 days or fewer.
- Quantities are whole base units (tests, vials, pieces). Fractional volumes are not modelled.
- Lot identity (item, lot number, expiry, received quantity, receipt time) is immutable in the database; lots cannot be deleted.

## Routes
- UI: `/inventory`
- `GET/POST /api/inventory/items` — list with stock summary; create item
- `POST /api/inventory/lots` — receive a lot
- `GET/POST /api/inventory/movements` — ledger (optionally `?lotId=`); consume, adjust, discard, quarantine, release

## Permissions
- `inventory.read`: view stock and ledger. Admin, Lab Manager, Lab Scientist, Viewer.
- `inventory.consume` (new): record consumption. Admin, Lab Manager, Lab Scientist.
- `inventory.manage`: create items, receive lots, adjust, discard, quarantine, release. Admin, Lab Manager.

## Database
Migration `db/migrations/0021_inventory_reagent_control.sql` (journal index 20). Apply with `npm run db:migrate`. Optional fictional demo data: `npm run db:seed:inventory` (needs an Admin user; never run against production).

## Verification — what was and was not done
- `npm test`: 131 tests pass (120 existing + 11 new). The new tests execute the real domain logic in `lib/inventory.ts` (expiry boundaries, FEFO ordering and ties, movement rules, stock summary, ledger replay) and statically check the migration, routes, permissions and UI.
- Six older tests asserted that migration 0020 was the newest; they now check it by tag so later migrations do not break them.
- NOT done, because this environment had no `node_modules`, no network and no PostgreSQL: `next build`, a full TypeScript type check, linting, running the migration, exercising the API routes (including the `FOR UPDATE` locking under concurrent consumption), rendering the UI, and RTL/visual checks. TSX and route files were only syntax-checked. Run `npm install && npm run build && npm run lint`, apply the migration to a scratch database, and click through `/inventory` in English and Arabic before relying on this.
- Not covered yet: purchase orders and receiving against POs, on-board/open-vial stability, automatic consumption from test runs, stock counts, and supplier management.
