# Increment 1.17 — Blood Bank Operations

Builds on increment 1.16 and adds operational, patient-linked blood bank workflows:

- transfusion requests with priority, component, indication, and requested/fulfilled unit counts
- crossmatch records linked to both a request and a specific inventory unit
- two-operator crossmatch workflow: operator A creates the test record; a different authorized operator records Compatible/Incompatible
- reservation of only available, screening-passed, unexpired units against independently verified compatible crossmatches
- a second operator must issue a reserved unit; the issue actor cannot be the reserver
- transfusion lifecycle: issue/start, complete, reaction documentation, and stop/discard handling
- inventory and transfusion request state updates plus audit events
- Carbon UI at `/blood-bank/operations`, Arabic/English, inherits all four Carbon themes

## Migration

Run `bun run db:migrate` to apply `0015_blood_bank_operations.sql` after `0014_blood_bank_core.sql`.

## Clinical safety boundary

This workflow records an outcome determined by qualified laboratory staff. It does **not** calculate ABO/Rh/component compatibility, replace validated serology, or replace bedside patient/unit identity checks and local transfusion policies. Validate all workflow, policy, authorization, storage/expiry rules, and adverse-reaction procedures with your transfusion service before any clinical use. Do not use development fixtures or unvalidated software for real patient care.

## Verification

`node --experimental-strip-types --test tests/*.node.test.mjs` — 91 tests passing. Dependency installation, Next.js production build, and live PostgreSQL migration/integration were not run in this environment.
