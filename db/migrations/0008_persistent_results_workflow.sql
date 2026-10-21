CREATE TYPE lab_result_status AS ENUM ('Needs entry', 'Entered', 'Technical review', 'Validated', 'Critical pending');
--> statement-breakpoint
CREATE TABLE lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_id uuid NOT NULL REFERENCES specimens(id),
  test_code varchar(32) NOT NULL,
  test_name varchar(200) NOT NULL,
  department varchar(120) NOT NULL,
  value numeric(18,6),
  unit varchar(40) NOT NULL DEFAULT '',
  reference_low numeric(18,6),
  reference_high numeric(18,6),
  critical_low numeric(18,6),
  critical_high numeric(18,6),
  status lab_result_status NOT NULL DEFAULT 'Needs entry',
  entered_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  entered_at timestamptz,
  reviewed_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  validated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (specimen_id, test_code)
);
--> statement-breakpoint
CREATE INDEX lab_results_status_idx ON lab_results(status, updated_at DESC);
--> statement-breakpoint
CREATE INDEX lab_results_specimen_idx ON lab_results(specimen_id);
--> statement-breakpoint
CREATE TABLE lab_result_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES lab_results(id),
  event_type varchar(64) NOT NULL,
  actor_id varchar(160) NOT NULL,
  from_status lab_result_status,
  to_status lab_result_status NOT NULL,
  value_snapshot numeric(18,6),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX lab_result_events_result_idx ON lab_result_events(result_id, occurred_at DESC);
