-- QMS: nonconformances, incidents, CAPA and internal audit records.
CREATE TABLE quality_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number varchar(32) NOT NULL UNIQUE,
  title varchar(200) NOT NULL,
  case_type varchar(32) NOT NULL CHECK (case_type IN ('Nonconformance','Incident','CAPA','Internal audit')),
  severity varchar(16) NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low','Medium','High','Critical')),
  status varchar(24) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Investigating','Action planned','Verification','Closed','Cancelled')),
  description text NOT NULL,
  source varchar(80),
  linked_entity_type varchar(80),
  linked_entity_id varchar(160),
  root_cause text,
  corrective_action text,
  preventive_action text,
  effectiveness_check text,
  owner_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  due_date timestamptz,
  created_by uuid NOT NULL REFERENCES app_users(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX quality_cases_status_idx ON quality_cases(status);
--> statement-breakpoint
CREATE INDEX quality_cases_type_idx ON quality_cases(case_type);
--> statement-breakpoint
CREATE INDEX quality_cases_due_idx ON quality_cases(due_date);
--> statement-breakpoint
CREATE INDEX quality_cases_created_idx ON quality_cases(created_at DESC);
--> statement-breakpoint
CREATE TABLE quality_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES quality_cases(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES app_users(id),
  event_type varchar(48) NOT NULL,
  from_status varchar(24),
  to_status varchar(24),
  notes text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX quality_case_events_case_idx ON quality_case_events(case_id, occurred_at);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION quality_case_events_append_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'quality_case_events is append-only'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER quality_case_events_append_only_trigger BEFORE UPDATE OR DELETE ON quality_case_events FOR EACH ROW EXECUTE FUNCTION quality_case_events_append_only_guard();
