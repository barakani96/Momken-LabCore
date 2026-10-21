# Increment 1.12 — Clinical Report Release & Corrections

Adds a report-release workflow on top of the existing persistent result and independent-validation workflow.

## Included
- `lab_reports` stores a versioned JSON snapshot for each released report; report number + version is unique and specimen/report references are retained.
- `POST /api/reports` issues a report by specimen accession or specimen UUID only when every result for the specimen has a value and status `Validated`.
- Corrections require a reference to the current released report and a reason of at least 12 characters. The previous version is marked superseded and the replacement receives the next version number.
- `GET /api/reports` lists released report versions; `GET /api/reports/:id` retrieves a specific immutable snapshot.
- `/reports` offers a Carbon UI for releasing/searching reports; `/reports/:id` provides a print-friendly clinical report view.
- Report release and correction actions are written to the audit trail. Arabic/English labels and print CSS are included.

## Migration
Apply migrations in order, including `db/migrations/0010_clinical_report_release.sql`:

```sh
bun run db:migrate
bun run dev
```

## Important limits
- This is a development workflow, not a validated clinical reporting product. Confirm local accreditation, privacy, retention, signature, report delivery and correction policies before clinical use.
- Report delivery is not integrated with email, portals, HL7 or FHIR.
- Snapshot stores the patient/specimen/result details at release time, while the current app does not yet store a cryptographic signature or PDF artifact in object storage.
- The automated tests are source-level Node tests. A full Next.js production build and live PostgreSQL integration test were not run in this environment.
