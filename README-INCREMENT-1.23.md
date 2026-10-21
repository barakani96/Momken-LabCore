# Increment 1.23 — Document Control & SOP Management

Adds controlled-document lifecycle management to Northstar ERP + LIMS.

## Features
- Controlled document register for SOPs, policies, forms, work instructions and manuals.
- Revision records with unique document/version identity and immutable revision content.
- Draft → In review → Approved or Rejected workflow, including separation of author and approver.
- Effective dates, review due dates and supersession of previously approved versions.
- Per-user, per-version acknowledgement records; acknowledgements cannot be edited or deleted through ordinary SQL operations.
- Audit events for creation, workflow changes and acknowledgements.
- Arabic/English UI, Carbon components and the existing Carbon theme provider.

## Routes
- UI: `/documents`
- List/create: `GET/POST /api/documents`
- Workflow and new revision: `PATCH /api/documents/:id` with `action` values `new-version`, `submit`, `approve`, `reject`.
- Acknowledge current approved version: `POST /api/documents/:id/acknowledge` with `{ "versionNumber": 1 }`.

## Permissions
- `documents.read`: read register and acknowledge current approved versions.
- `documents.manage`: create documents, create revisions and submit for review.
- `documents.approve`: approve or reject versions. The version author cannot approve their own revision.

Admin receives all permissions. Lab Manager receives document read/manage/approve. Lab Scientist and Viewer receive read access. Adjust grants via the existing permission administration process where appropriate.

## Database
Migration: `db/migrations/0020_document_control_sop.sql` (journal index 19). Apply with `bun run db:migrate` after configuring PostgreSQL in `.env.local`.

Revision content and acknowledgement rows are protected from ordinary UPDATE/DELETE operations by PostgreSQL triggers. Workflow metadata on revision rows is updated for submission and review, while document identity, revision number, content, change summary and creator remain immutable. This is an application control, not a substitute for database-level separation of duties, backup and external retention controls.

## Verification
Run `node --experimental-strip-types --test tests/*.node.test.mjs` or `bun run test`. Static/domain tests do not replace a full Next.js build, database migration rehearsal or operational validation. No live PostgreSQL instance or installed `node_modules` was available for this increment.
