# Increment 1.20 — Password Recovery & Session Management

## Added
- Password recovery request endpoint with generic responses to avoid account enumeration.
- Random, single-use, 30-minute reset tokens; only SHA-256 hashes are persisted.
- Password reset invalidates all user sessions and records audit/auth events.
- Authenticated password change verifies the current password, rotates the current session token, and revokes other sessions.
- Active-session listing, per-session revocation, and revoke-other-sessions action.
- Carbon UI at `/security`, recovery request at `/forgot-password`, reset form at `/reset-password`, and a login recovery link.
- Migration `0017_password_recovery_session_management.sql` adds `app_users.password_changed_at` and a partial expiry index.

## Mail configuration
Configure `APP_BASE_URL`, `MAIL_DELIVERY_URL`, and `MAIL_DELIVERY_TOKEN` in `.env.local`. The configured endpoint must accept an authenticated POST with `to`, `subject`, `text`, `template`, and `variables` fields and return a 2xx status. Do not expose recovery URLs in production. `DEV_EXPOSE_RECOVERY_LINK=true` is intended only for local development.

If the mail endpoint is missing, the API deliberately keeps its response generic; no email is delivered. Configure and test the provider before relying on recovery in production.

## Apply and run
```bash
bun install
bun run db:migrate
bun run test
bun run dev
```

## Security notes
- Recovery tokens are random, hashed at rest, expire after 30 minutes, and can be consumed only once.
- Passwords must be at least 12 characters with uppercase, lowercase, and a number.
- Resetting a password revokes all existing sessions. Changing a password rotates the current session and revokes the others.
- Validate provider delivery, rate limits, HTTPS, reverse-proxy configuration, and end-to-end session invalidation before production use.
- This increment has automated source-level regression tests; a live PostgreSQL and Next.js production build are not asserted unless run in the deployment environment.
