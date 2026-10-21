# Increment 1.13 — Patient Portal & Secure Report Delivery

## Delivered
- `report_portal_grants`: hashed bearer tokens, expiry, revocation, creation actor and last access.
- `report_portal_access_events`: success/denied view attempts with hashed IP, limited user-agent, timestamp and grant reference.
- Staff management UI at `/admin/portal` for creating short-lived access links for released reports and revoking active links.
- Public, no-store patient report page at `/portal/[token]`, displaying the immutable report snapshot with print layout.
- Staff API routes require `reports.portal.manage`; Lab Manager and Admin receive this permission by role. Admin retains the permission override policy from prior increments.
- Staff grant creation and revocation append audit events.
- Migration `0011_patient_portal_secure_delivery.sql`.

## Apply
```bash
bun run db:migrate
bun run dev
```

## Important security boundary
These are bearer links: anyone who possesses a valid link can view the report. Tokens are cryptographically random (32 bytes), only SHA-256 hashes are stored, and grants expire in 1–30 days or can be revoked. Responses disable caching and search indexing. The portal does not currently perform patient identity proof, authenticated patient accounts, email/SMS delivery, or edge-level throttling. Use synthetic data only until the deployment is reviewed for privacy, security, and clinical compliance.
