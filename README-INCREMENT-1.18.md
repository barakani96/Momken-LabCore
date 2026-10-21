# Increment 1.18 — Account Security & MFA

Adds authenticator-based TOTP MFA for staff accounts, AES-256-GCM encrypted MFA secrets, one-time hashed recovery codes, MFA-aware login, enable/disable APIs, audit events, and a Carbon account-security screen at `/security`.

## Configuration

Set `MFA_ENCRYPTION_KEY` to a securely generated 32-byte key encoded as 64 hex characters (`openssl rand -hex 32`). Keep it in a secrets manager in production. Losing the key makes enrolled MFA secrets undecryptable. Never commit the real key.

Apply migrations using the project's normal database migration workflow before enabling MFA. Setup is authenticated and same-origin protected. Enrollment is pending until a valid TOTP code is verified; recovery codes are shown only once and stored as hashes. Login requires a valid TOTP code or an unused recovery code after password verification. Disabling MFA requires a valid TOTP or unused recovery code and invalidates sessions.

## Important limitations

- Email-based password recovery is not enabled in this increment. The token table is a foundation only; no reset email is sent and no reset endpoint is exposed.
- Before production, add deployment-specific rate limits to MFA verification and recovery-code attempts, backup/rotation procedures for the encryption key, alerting, and independent security review.
- Validate application build and live PostgreSQL integration in the deployment environment.
