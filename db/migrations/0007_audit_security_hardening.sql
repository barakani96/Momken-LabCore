CREATE TABLE login_attempt_buckets (
  bucket_key varchar(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX login_attempt_buckets_blocked_idx ON login_attempt_buckets(blocked_until);
--> statement-breakpoint
CREATE INDEX audit_events_occurred_idx ON audit_events(occurred_at);
--> statement-breakpoint
CREATE INDEX audit_events_actor_idx ON audit_events(actor_id, occurred_at);
--> statement-breakpoint
CREATE INDEX audit_events_action_idx ON audit_events(action, occurred_at);
