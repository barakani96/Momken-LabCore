# Increment 1.19 — Seed and sign-in startup fix

## Fixes

- Fixed the `blood_transfusion_patient_idx` Drizzle schema declaration to use the callback's `table.patientId` and `table.createdAt` columns. Referencing `bloodTransfusionEvents` while its `pgTable()` initializer was still running passed undefined column metadata into Drizzle and caused `JSON.parse("undefined")` during schema initialization. This prevented `db:seed` and server routes from starting.
- Hardened the sign-in client response handling: it now reads response text and parses JSON safely. If Next.js returns an HTML error page or another invalid response, the UI shows a useful HTTP/status message instead of the raw `JSON.parse: unexpected character` exception.
- Added regression tests for both failures.

## Verification

Run `bun run test`. Then set `DATABASE_URL` in `.env.local` and run `bun run db:seed`. Ensure PostgreSQL is reachable and migrations have been applied first. The seed command's live database execution must be verified in the target environment.
