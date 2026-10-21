# Increment 1.14 — Patient Identity Verification & Portal Accounts

## Delivered
- Separate patient portal accounts and sessions; no reuse of employee credentials.
- Staff provisioning endpoint and Carbon-based account management screen at `/admin/patient-accounts`.
- One-time activation token stored as SHA-256 hash, 24-hour expiry, minimum 14-character password.
- Patient sign-in at `/patient-portal/login`, isolated HttpOnly `northstar_patient_session` cookie, four-hour expiry, logout revocation.
- Patient dashboard and server-side report ownership checks. A patient can only retrieve released reports whose specimen belongs to their linked patient record.
- Persistent login attempt throttling using the shared PostgreSQL buckets (8 attempts, 15-minute window), with generic authentication failures.
- Audit events for invitation, activation, login success/failure, and logout.
- Arabic/RTL layout compatibility, responsive styling, IBM Carbon controls, and no-index metadata.

## Apply and run
```bash
bun install
bun run db:migrate
bun run dev
```
Requires the `DATABASE_URL` configured as documented in `.env.example`. Migration `0012_patient_portal_accounts.sql` is included in the migration journal.

## Important operational boundaries
- Staff must verify identity using the laboratory's approved procedure before inviting a patient.
- The activation URL is a bearer secret and is shown once; deliver it only through an approved secure channel. Email/SMS delivery is not automated.
- No OTP/MFA, patient self-service recovery, verified email ownership, external identity proofing, or independent security assessment is included.
- Patient report details render a safe JSON representation of the immutable snapshot for this increment; a polished clinical PDF/template is a future task.
- Static tests do not replace a real Next.js build, PostgreSQL integration tests, penetration testing, or clinical/privacy validation. Do not use real patient data before these checks.
