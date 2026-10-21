CREATE SEQUENCE IF NOT EXISTS lab_specimen_seq START WITH 200000 NO CYCLE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS specimen_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_id uuid NOT NULL REFERENCES specimens(id),
  event_type varchar(64) NOT NULL,
  from_status specimen_status,
  to_status specimen_status NOT NULL,
  reason text,
  actor_id varchar(160) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS specimen_events_specimen_idx ON specimen_events(specimen_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS patients_name_idx ON patients(family_name, given_name);
