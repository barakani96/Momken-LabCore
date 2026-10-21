# Northstar ERP + LIMS — Increment 1

A greenfield clinical laboratory worklist starter built with official IBM Carbon React components, Next.js App Router, TypeScript, PostgreSQL, Drizzle ORM, Zod, and Vitest. English and Arabic UI use Google Fonts Noto Sans and Noto Sans Arabic (no IBM Plex font dependency).

> **Safety / maturity:** this is an engineering starter and demonstration, not a validated clinical system. The worklist is seeded with fictional records and the current browser interactions are session-local. Do not enter real patient information. Authentication and server-side role authorization are not yet implemented; the `x-actor-id` header is only a development placeholder and is not a trusted identity. Audit events are written for order creation and accessioning, but the full workflow, clinical validation, and production security review are not complete. Do not use real patient data.

## Increment 1.4 additions

- PostgreSQL-backed `GET/POST /api/orders` with Zod validation, registered-patient ID/name matching, active catalog checks, compatible specimen requirements, transaction-safe order accession sequence, catalog version snapshots, and audit events.
- `POST /api/orders/:id/accession` locks an order row, creates a specimen record and order/specimen link atomically, changes the order to `Collected`, and writes an audit event.
- Orders workbench now loads persisted orders, creates orders through the API, and supports accessioning from the table.
- Ordered SQL migrations are included: `0001_base_schema.sql`, `0002_catalog_orders.sql`, and `0003_persistent_orders_accessioning.sql`, with a Drizzle migration journal. `npm run db:migrate` applies them in order; inspect the target database before running migrations.
- The order form expects an existing patient record. The bundled seed data includes fictional patients such as `PAT-004281` / `Amal Hassan`.

## Increment 1 scope

- Carbon application shell and enterprise navigation.
- Carbon-based specimen worklist with search, status/priority filters, clear filters, pagination, status/priority tags, refresh, CSV export, and specimen-registration modal.
- Domain-level workflow transition guardrails.
- Fictional clinical-laboratory records and metric tiles.
- PostgreSQL schema for patients, specimens, and audit events, with Drizzle config and seed script.
- Zod-validated API skeleton for listing and registering specimens.
- Vitest tests for filtering and allowed/disallowed workflow transitions.

## Prerequisites

- Node.js 20.9+ (Node 22 recommended)
- PostgreSQL 15+

## Run locally

```bash
cp .env.example .env.local
# Edit DATABASE_URL to point at your local PostgreSQL database.
npm install
npm run db:migrate
npm run db:seed
npm test
npm run dev
```

Open `http://localhost:3000/worklist`.

The specimen worklist and results workbench still use fictional demonstration state; the order workbench requires PostgreSQL. API endpoints return HTTP 503 until `DATABASE_URL` is configured and migrations have been applied. `db:seed` upserts fictional patients, specimens, and catalog definitions. Never point the seed script at a production database.

## Commands

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — lint source
- `npm test` — unit tests
- SQL migrations are checked into `db/migrations`; review schema changes and add a migration before deployment
- `npm run db:migrate` — apply migrations
- `npm run db:seed` — insert fictional development records

## Internationalization and typography

- English typography uses Google Fonts **Noto Sans**; Arabic uses **Noto Sans Arabic** with Noto Sans as a fallback.
- Google Fonts are loaded from `fonts.googleapis.com` with `fonts.gstatic.com` preconnect hints.
- The application and Carbon component font stack is overridden through shared CSS font variables and selectors.
- RTL pages use the Arabic font family while retaining Latin readability for identifiers.
- Internet access is required for Google Fonts; local system sans-serif fallbacks remain configured.

## Architecture

```text
app/
  api/specimens/route.ts  Zod-validated PostgreSQL API foundation
  worklist/page.tsx       Worklist route
components/
  app-shell.tsx           Carbon header, SideNav and app frame
  worklist.tsx            Worklist table and client interactions
lib/specimens.ts          Types, fictional fixtures and workflow guardrails
db/schema.ts              PostgreSQL/Drizzle patient, specimen and audit tables
db/seed.ts                Fictional seed data
tests/specimens.test.ts   Domain unit tests
```

## Workflow rules in this increment

- Collected → In progress or Rejected
- In progress → Pending review or Rejected
- Pending review → In progress, Authorized, or Rejected
- Rejected → Collected (requires an explicit recollection/re-entry process in a production implementation)
- Authorized → terminal in this simplified starter

These are preliminary technical guardrails, not clinical policy. A production state machine must define role permissions, reason capture, immutable result versions, specimen rejection/recollection controls, audit events, and approval separation of duties.

## Security and clinical work remaining before production

1. Configure OIDC/SSO and server-side RBAC; do not trust client state for identity or authorization.
2. Require authenticated actor identity on every mutation; write mandatory audit events transactionally.
3. Implement database-backed workflow transitions with optimistic concurrency, idempotency, and authorization checks.
4. Add results, test catalog, units, method-specific reference intervals, critical-result policy, delta checks, result amendment, and signed report release.
5. Establish tenant/site boundaries, encryption and key management, secret handling, rate limiting, structured logs, retention, backups, restore drills, and disaster recovery.
6. Add integration/e2e tests, accessibility tests, migration CI, dependency scanning, and validated deployment configuration.
7. Perform clinical safety, privacy, regulatory, and laboratory accreditation review applicable to deployment jurisdiction.

## Acceptance checks for increment 1

- Search works across accession, patient name/number, department and test code.
- Status and priority filters compose with search; clear filters resets the worklist.
- CSV export reflects current filters.
- Registration validates required fields and adds a fictional record to the current session.
- Workflow transitions reject invalid state jumps.
- Domain tests pass with `npm test`.

## Test execution in constrained environments

The default test command uses Node.js's built-in test runner and TypeScript type stripping, so the domain test suite can run without Vitest installed:

```bash
npm test
```

Vitest, React Testing Library, and Playwright coverage can be expanded once dependencies are installed in the project environment.

## Internationalization and RTL (Increment 1.1)

- English (`en`, LTR) and Arabic (`ar`, RTL) are supported by a shared React i18n provider.
- The Carbon header language action switches languages and persists the preference in `localStorage` (`northstar-locale`).
- The provider updates the document `lang`, `dir`, and `data-locale` attributes; Carbon navigation, worklist filters/table, and registration form inherit explicit RTL direction.
- Arabic translations cover navigation, specimen worklist labels, filters, statuses, notifications, and registration fields. Untranslated domain extensions fall back to the source English string.
- RTL-specific CSS mirrors the fixed Carbon side navigation and content offset, aligns table/form content, and allows translated labels to wrap instead of clipping. Accession identifiers remain LTR for readability.
- `npm test` includes locale/direction, translation, language-switch persistence wiring, and RTL coverage assertions alongside specimen domain tests.

For production, expand the translation catalog for every module and Carbon-provided pagination/accessibility message, conduct native Arabic linguistic review, and run browser-level visual/accessibility tests at narrow widths and with long translated strings. RTL styling should be verified against the exact Carbon version pinned by the deployment.

## Increment 1.2 — Results & technical-review workbench

The `/results` route adds a Carbon-based structured result-entry workbench with fictional CBC, chemistry, coagulation, and immunology records. It supports numeric result entry, illustrative reference-interval flags, combined search/status/department filters, pagination, CSV export, and routing eligible records to a technical-review queue. The result domain tests cover numeric parsing, range flags, filtering, and guarded transitions.

**Safety boundary:** all values and reference intervals are illustrative, not clinically validated. Critical-range examples are blocked from the simple review action. This increment does not authorize results, notify clinicians, or release reports; it is still session-local and must not be used with real patient data. Production implementation needs versioned method/analyzer-specific intervals, role checks, critical-result escalation and acknowledgment, immutable result versions, transactional audit records, persistence, concurrency controls, and clinical validation.


## Increment 1.3 — Test catalog and order-entry workbench

This increment adds Carbon-based `/catalog` and `/orders` screens, a fictional test catalog, search and department filters, CSV export, an order composer, test/specimen compatibility validation, session-only demonstration order records, and domain tests. It also adds Drizzle schema definitions for versioned test definitions, panels, reference intervals, orders, and order items, plus a SQL migration draft at `db/migrations/0002_catalog_orders.sql`.

**Important limitations:** the catalog and orders UI still uses in-memory demonstration data; creating an order does not persist to PostgreSQL, create a patient record, reserve a specimen, or print a label. The migration is a draft and should be tested against the target database and existing migration history before applying. Reference interval records are modeled but no clinical intervals are seeded. Test definitions and collection instructions are illustrative and must be validated by the laboratory before any clinical use.

Run domain and localization tests with `npm test` (or `node --experimental-strip-types --test tests/*.node.test.mjs`).


## Increment 1.5 — Patient registry and specimen lifecycle

- Added `/patients` patient registry with search by patient number/name and a registration form for demographic identity fields. Patient numbers are unique; duplicate registration returns `409` and never overwrites the existing person.
- Specimen creation now requires an existing patient record and a normalized name match. A non-cycling PostgreSQL sequence allocates specimen accession numbers; creation, audit entry, and initial lifecycle event are committed in one transaction.
- Added transactional specimen status transitions with row locking, server-side transition validation, required rejection and recollection details, audit events, and a `specimen_events` history table.
- Worklist now attempts to load persisted specimens, transitions them through the API, supports rejection reasons, refresh, and printable human-readable accession labels. The printed label explicitly states that machine-readable barcode generation is not yet configured.
- Order accessioning now writes the initial specimen lifecycle event as well.

Apply the new migration with `npm run db:migrate` before starting the app. The seeded identities are fictional. Authentication/RBAC remains a required next security increment; `x-actor-id` is still a development placeholder and must not be treated as trusted identity. This is not validated for clinical use and must not receive real patient data.

## Increment 1.6 — Seed environment loading and specimen barcodes

- Standalone `tsx` and Drizzle commands now load `.env.local` and then `.env` through `dotenv`; shell-provided environment variables take precedence. This fixes `bun run db:seed` failing even when a valid `.env.local` exists.
- Added `bun run db:seed:check` to validate that `DATABASE_URL` exists and resembles a PostgreSQL URL without printing credentials.
- Added `/api/barcode?text=LAB-2026-000001`, a bounded Code 128 SVG endpoint, and wired specimen label printing to include the generated machine-readable barcode plus the readable accession.

### Fix for `DATABASE_URL is required`

Run these commands from the project root (the directory containing `package.json`):

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL to your actual PostgreSQL connection string.
bun run db:seed:check
bun run db:migrate
bun run db:seed
```

Example local URL: `postgresql://postgres:your_password@localhost:5432/erp_lims`. The database must already exist and PostgreSQL must be running. Do not commit `.env.local`. If you intentionally provide `DATABASE_URL` in your shell or deployment environment, that value takes precedence over files.

**Security status:** this increment does not add login or enforce server-side role-based authorization. Existing `x-actor-id` headers remain untrusted development placeholders. Do not expose this app to a network or use real patient data until authentication, authorization, secure session management, and deployment hardening are implemented and reviewed.

## Increment 1.7 — Authentication and role-based access

- Adds `app_users` and `app_sessions` tables in migration `0005_authentication_rbac.sql`.
- Passwords are stored as salted scrypt hashes; opaque session tokens are random, stored only as SHA-256 hashes, expire after eight hours, and are delivered through an HttpOnly, SameSite=Lax cookie.
- Middleware redirects browser routes to `/login` and rejects API requests without a session cookie. Each protected API also verifies the session against PostgreSQL; a forged cookie alone is not sufficient.
- Roles: `Admin`, `Lab Manager`, `Lab Scientist`, `Phlebotomist`, `Viewer`. Read access is available to authenticated roles; write endpoints currently permit the first four roles. Fine-grained per-module policies and user-management UI remain future work.
- Audit actor IDs for updated patient/order/specimen endpoints come from the authenticated session, not the `x-actor-id` request header.

### Provision the first administrator

After setting `DATABASE_URL` in `.env.local`, set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (at least 14 characters) in that file, optionally set `BOOTSTRAP_ADMIN_NAME`, then run:

```bash
bun run db:migrate
bun run db:auth-admin
bun run dev
```

Open `/login` and sign in with that account. The provisioning command refuses to overwrite an existing account. Do not commit `.env.local`; remove the bootstrap password from local shell history/secret storage after provisioning. `bun run db:seed` can still seed fictional laboratory records, and can also create the bootstrap administrator if both bootstrap variables are set; it will not overwrite an existing account.

This increment is a development foundation, not a security certification. Before clinical or internet-facing deployment, add rate limiting / lockout, CSRF strategy for cookie-authenticated mutations, password reset and rotation, administrator-managed accounts, finer-grained authorization, session revocation UI, secure deployment configuration, and security review. Never use real patient data in this starter.


## Increment 1.8 — User administration and fine-grained permissions

- Added `/admin/users` for creating accounts, changing roles, enabling/disabling users, and setting per-user allow/deny permission overrides.
- Added `0006_user_admin_permissions.sql` for permission overrides and authentication event history.
- Domain APIs now check explicit permission keys (for example `patients.create`, `orders.accession`, and `specimens.transition`) in addition to requiring a valid active database session.
- Disabling an account revokes its sessions. Self-demotion/self-deactivation is blocked, and active-administrator changes are serialized to prevent last-admin lockout.
- Login successes/failures are recorded with a SHA-256 hash of the source IP instead of storing the raw IP. Forwarded-IP headers must only be trusted behind a correctly configured proxy.
- New accounts require a password of at least 14 characters; passwords are stored as scrypt hashes.

Apply the migration and sign in as a provisioned Admin before opening `/admin/users`:

```bash
bun run db:migrate
bun run db:auth-admin
bun run dev
```

The role-permission matrix is defined in `lib/auth/permissions.ts`; user-specific overrides take precedence over role defaults. Admin permission overrides are fixed. This increment is not a production security certification: rate limiting, CSRF defense appropriate to deployment, password recovery, and a full security review remain necessary.


## Increment 1.9 — Audit trail & security hardening

- `/admin/audit` provides a permission-protected, paginated view of system audit events and authentication outcomes, with source switching and query search.
- `audit.read` is required to query either log source. The API caps pages at 50 rows and validates filter input.
- Login attempts use PostgreSQL-backed buckets keyed by a SHA-256 hash of the observed client address and normalized email. The eighth attempt within a 15-minute window is throttled; a successful login clears the bucket. Configure trusted proxy headers correctly at the deployment edge.
- State-changing API requests reject cross-origin `Origin`/`Referer` values; production requests without either header are rejected. Browser clients must use the canonical application origin.
- Migration `0007_audit_security_hardening.sql` adds persistent login throttle buckets and audit indexes. Run `bun run db:migrate`.
- Security note: throttling and origin checks are defense-in-depth, not a substitute for deployment-level rate limits, trusted-proxy configuration, TLS, dependency updates, penetration testing, or a formal security review. This starter is not certified for clinical production use.

## Increment 1.10 — Persistent results and validation workflow

This increment introduces a PostgreSQL-backed result record and lifecycle API. Apply migration `0008_persistent_results_workflow.sql` after the earlier migrations. Result records are unique per specimen/test code and retain entry, technical-review, and validation actor/time fields plus an append-only result event history. Updates use optimistic `version` checks to prevent silent overwrites. The result API is protected by `results.read`, `results.enter`, and `results.validate` permissions; validation requires technical review and a different user from the person who entered the value. Values outside configured critical limits are blocked from review/validation and enter `Critical pending`, which requires a separately designed critical escalation process.

Endpoints: `GET /api/results?q=&status=&page=`, `POST /api/results` (`specimenId`, `testCode`), `PATCH /api/results/:id` (`value`, `expectedVersion`), and `POST /api/results/:id/review` (`action: review|validate`, `expectedVersion`). The `/results` workbench now consumes these APIs and supports selecting a registered specimen/test, entering a value, requesting technical review, and independent validation. Reference and critical intervals are not inferred automatically; a clinical configuration process must supply approved ranges. This workflow is not validated for patient care or report release.

## Increment 1.11 — Reference ranges, critical communication, and Carbon themes
- Added versioned reference interval governance with age/sex/population fields, source attribution, critical thresholds, draft/approved/retired states, effective dates, and audit events.
- Added critical-result communication records with recipient, method, time, acknowledgement, and escalation states. This is a workflow ledger only; it does not send notifications to clinicians.
- Added `/reference-ranges` and APIs under `/api/reference-intervals` and `/api/critical-results`.
- Carbon theme switching supports all four official Carbon v11 themes: `white`, `g10`, `g90`, and `g100`; selection persists in local storage. Application surfaces use semantic Carbon tokens where supported.
- Apply migrations using `bun run db:migrate`. Reference intervals must be populated and approved by authorized laboratory governance before clinical use. No example intervals are clinically endorsed.


## Increment 1.13 — Patient portal and secure report delivery

- `report_portal_grants` stores only SHA-256 hashes of 256-bit random bearer tokens, with expiry, revocation and last-access metadata.
- Authorized staff can issue access links for released reports from `/admin/portal`; validity is limited to 1–30 days and links can be revoked.
- `/portal/[token]` presents a minimal, print-friendly report view without requiring a staff session. The token is exchanged server-side for the immutable released report snapshot.
- Access attempts are written to `report_portal_access_events`; raw IP addresses are not stored, only SHA-256 hashes.
- Responses are marked `Cache-Control: no-store, private`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`.
- Apply migrations `0011_patient_portal_secure_delivery.sql` and `0012_patient_portal_accounts.sql` before using the patient portal.

**Security note:** This iteration uses bearer links: anyone who obtains the link can view that report until expiry or revocation. Deliver links only through an approved secure channel. Before clinical production, add stronger identity proof or authenticated patient accounts, edge/application rate limits, security review, and a retention policy for access logs. No email/SMS delivery is configured.


## Increment 1.14 — Patient identity accounts

Patient identities are isolated from employee accounts and use a separate `northstar_patient_session` cookie. Staff with `reports.portal.manage` can invite a patient from `/admin/patient-accounts` after verifying identity. The activation token is stored only as a SHA-256 hash, shown once, and expires after 24 hours. Patients activate with a password of at least 14 characters and sign in at `/patient-portal/login`; the dashboard at `/patient-portal/dashboard` lists only released reports linked to that patient's account. Report detail access is checked server-side against the patient account on every request. Sessions expire after four hours and are revoked on sign-out.

Apply `bun run db:migrate` after setting `DATABASE_URL`. Invitation delivery is not automated: the staff member must deliver the activation URL through an approved secure channel. This increment does not provide email/SMS OTP, account recovery, identity proofing, or a production rate limiter for patient sign-in. Do not use real patient data until security/privacy review and deployment hardening are complete.

## Latest increment
See [README-INCREMENT-1.15.md](./README-INCREMENT-1.15.md) for patient account security, password changes, active session management, and migration 0013.


## Increment 1.16 — Blood Bank Core
See `README-INCREMENT-1.16.md`. New route: `/blood-bank`; migration: `0014_blood_bank_core.sql`.

## Increment 1.17 — Blood Bank Operations

See `README-INCREMENT-1.17.md`. Apply migration `0015_blood_bank_operations.sql` after the blood bank core migration. The new operations workbench is available at `/blood-bank/operations`.


## Increment 1.18 — Account Security & MFA

See `README-INCREMENT-1.18.md`. Staff accounts can enroll authenticator-based TOTP MFA, use one-time recovery codes, and manage MFA from `/security`. Configure `MFA_ENCRYPTION_KEY` before enrollment.

## Increment 1.19 — Seed and sign-in startup fix

See `README-INCREMENT-1.19.md`. Fixes a Drizzle schema self-reference that blocked schema initialization and improves sign-in error handling when the server responds with non-JSON output.

## Increment 1.20 — Password Recovery & Session Management
See `README-INCREMENT-1.20.md` for recovery-mail configuration, one-time reset tokens, password changes, and session revocation.

## Increment 1.21 — Audit & Compliance Center

See [`README-INCREMENT-1.21.md`](./README-INCREMENT-1.21.md) for the append-only SHA-256 audit chain, integrity endpoint, filtered CSV exports, permission model, and operational caveats.

## Increment 1.22 — Quality Management System
See `README-INCREMENT-1.22.md` for the quality register, CAPA lifecycle, API, and migration instructions. Apply migration `0019_quality_management_system.sql` before using `/quality`.

## Document Control & SOP Management (Increment 1.23)

Controlled documents, revision history, independent review/approval, effective dates and staff acknowledgements are available at `/documents`. See `README-INCREMENT-1.23.md` for API routes, permissions and migration details.
