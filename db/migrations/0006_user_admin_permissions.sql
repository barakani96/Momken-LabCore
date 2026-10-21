CREATE TABLE user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  permission_key varchar(120) NOT NULL,
  allowed boolean NOT NULL,
  granted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_user_permission_uq UNIQUE (user_id, permission_key)
);
--> statement-breakpoint
CREATE INDEX user_permission_overrides_user_idx ON user_permission_overrides(user_id);
--> statement-breakpoint
CREATE TABLE auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  email_attempted varchar(254),
  event_type varchar(64) NOT NULL,
  outcome varchar(24) NOT NULL,
  ip_hash varchar(64),
  user_agent varchar(400),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX auth_events_occurred_idx ON auth_events(occurred_at);
--> statement-breakpoint
CREATE INDEX auth_events_user_idx ON auth_events(user_id, occurred_at);
