CREATE TABLE report_portal_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES lab_reports(id) ON DELETE RESTRICT,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);
CREATE INDEX report_portal_grants_report_idx ON report_portal_grants(report_id, created_at);
CREATE INDEX report_portal_grants_expiry_idx ON report_portal_grants(expires_at);
CREATE TABLE report_portal_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid REFERENCES report_portal_grants(id) ON DELETE SET NULL,
  event_type varchar(40) NOT NULL,
  outcome varchar(24) NOT NULL,
  ip_hash varchar(64),
  user_agent varchar(500),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_portal_access_events_grant_idx ON report_portal_access_events(grant_id, occurred_at);
