# Increment 1.22 — Quality Management System (QMS)

Adds a PostgreSQL-backed quality register for nonconformances, incidents, CAPA records, and internal-audit findings.

## Features
- Create and search quality cases with type, severity, source, linked record, and target due date.
- Controlled lifecycle: Open → Investigating → Action planned → Verification → Closed. Supported return paths and cancellation are validated server-side.
- CAPA fields: root-cause analysis, corrective action, preventive action, and effectiveness evidence.
- Closure requires documented effectiveness evidence; action planning requires a corrective or preventive action.
- Append-only case-history events, plus entries in the existing tamper-evident audit log.
- English/Arabic UI, RTL, and existing Carbon theme support.
- API permissions: `quality.read` for list; `quality.manage` for create/update.

## Apply
1. Back up the database and confirm the prior migrations are applied.
2. Run `bun run db:migrate` to apply `0019_quality_management_system.sql`.
3. Run `bun run test` and `bun run dev`.
4. Open `/quality`.

## API
- `GET /api/quality/cases?q=&status=&caseType=&severity=&page=`
- `POST /api/quality/cases`
- `PATCH /api/quality/cases/:id`

## Important limits
This increment records quality cases and workflow evidence; it is not a validated regulatory compliance package. Internal-audit records use the same quality-case lifecycle and do not yet provide a full audit-program calendar, checklist builder, or formal approval/signature service. Test with a staging PostgreSQL database before operational use. This environment did not run a Next.js production build or live PostgreSQL migration.
