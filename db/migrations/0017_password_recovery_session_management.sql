-- Account password recovery and session lifecycle audit support.
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_password_recovery_tokens_expiry_idx ON app_password_recovery_tokens(expires_at) WHERE used_at IS NULL;
