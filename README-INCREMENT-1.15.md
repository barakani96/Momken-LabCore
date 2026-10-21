# Increment 1.15 — Patient Account Security

This increment adds patient self-service account security to the Northstar ERP + LIMS portal.

## Included
- `/patient-portal/security`: Carbon-based password-change and active-session management screen.
- `POST /api/patient-portal/password`: verifies the current password, enforces a 14-character minimum, hashes the new password with scrypt, revokes other active sessions in a transaction, and records an audit event.
- `GET /api/patient-portal/sessions`: lists only unexpired sessions belonging to the signed-in patient, marks the current session, and never returns session-token hashes.
- `DELETE /api/patient-portal/sessions/:id`: account-scoped session revocation with same-origin protection; revoking the current session also clears its cookie.
- Session user-agent metadata and `password_changed_at` via migration `0013_patient_session_security.sql`.

## Setup
1. Configure `DATABASE_URL` using `.env.example`.
2. Run `bun install`.
3. Run `bun run db:migrate`.
4. Run `bun run dev` and sign in to the patient portal.
5. Open `/patient-portal/security`.

## Security notes
- Patient identities remain separate from employee accounts.
- Password changes preserve the current session but revoke all other sessions for that account.
- User-agent strings are untrusted client metadata and must not be treated as identity evidence.
- Email ownership verification, self-service password recovery, MFA, and independent identity proofing are not included in this increment.
- Do not use real patient data before a security/privacy review and database-backed integration testing.

## Verification
Automated Node tests cover migration sequencing, password verification and session revocation safeguards, account-scoped session listing/revocation, and Carbon UI wiring. A full Next.js production build and live PostgreSQL integration test have not been run in this environment.
