# Increment 1.16 — Blood Bank Core

Adds a blood bank foundation to Northstar ERP + LIMS:
- donor registry and eligibility state
- donation registration and blood component units
- inventory search by unit/donor/donation, blood group, status and expiry
- quarantine-first release workflow; available stock requires passed screening and an unexpired unit
- schema for patient-specific crossmatch and transfusion traceability
- audit events and `bloodbank.read` / `bloodbank.manage` / `bloodbank.issue` permissions
- Carbon UI at `/blood-bank`, with Arabic/English labels and inherited four Carbon themes

## Migration
Run `bun run db:migrate` to apply `0014_blood_bank_core.sql`.

## Important clinical limitation
This is a development workflow foundation, not a validated blood bank information system. It does not calculate compatibility or authorize transfusion, and the crossmatch/transfusion tables are not yet exposed as an operational workflow. Do not use for real blood products or patient care until local transfusion policies, donor screening, component-specific expiry/storage requirements, two-person verification, traceability, alerts, and validation are implemented and clinically approved.
