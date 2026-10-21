# Increment 1.21 — Audit & Compliance Center

## Delivered

- Append-only audit history enforced by PostgreSQL `BEFORE UPDATE OR DELETE` trigger.
- SHA-256 hash chain with monotonic sequence, previous hash, and event hash. Existing audit rows are backfilled during migration `0018_audit_compliance_chain.sql`.
- Authenticated integrity-check endpoint: `GET /api/admin/audit/integrity`.
- Date-range and source filters for system audit events and authentication events.
- Permission-gated CSV export (`audit.export`) capped at 5,000 rows per request; export values are escaped and spreadsheet formula injection is neutralized.
- Carbon-based UI at `/admin/audit`, with integrity status, source selector, date filters, pagination, and export action. Arabic/English and current Carbon theme are inherited from the app shell.
- Lab Manager and Admin have audit export permission; read-only audit access remains separately scoped.

## Apply

```bash
bun install
bun run db:migrate
bun run test
bun run dev
```

Migration `0018` uses PostgreSQL `pgcrypto` (`digest`/`sha256`). If your managed database does not permit enabling `pgcrypto`, enable it through the provider's extension controls or an administrator before running migrations.

## Important limitations

- Hash chaining is tamper-evident and detects changes to rows/links; it is not cryptographic proof against a database superuser who can alter the trigger, functions, or all hashes.
- For stronger compliance assurance, ship audit events to a separately administered immutable/WORM destination, protect database administration, and periodically verify exported checkpoints.
- CSV exports are capped at 5,000 rows. The response includes `X-Export-Truncated: true` if more rows matched; narrow the date range to export the rest.
- Automated source tests do not replace an integration test against the actual PostgreSQL provider. Next.js production build and database migration execution were not performed in this environment.
