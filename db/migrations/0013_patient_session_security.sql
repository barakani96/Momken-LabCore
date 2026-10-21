ALTER TABLE patient_portal_sessions ADD COLUMN user_agent varchar(500);
ALTER TABLE patient_portal_accounts ADD COLUMN password_changed_at timestamptz;
CREATE INDEX patient_portal_sessions_recent_idx ON patient_portal_sessions(account_id, created_at DESC);
