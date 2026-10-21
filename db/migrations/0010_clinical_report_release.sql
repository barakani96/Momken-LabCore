-- Increment 1.12: immutable released report snapshots and governed corrections.
CREATE TABLE lab_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specimen_id uuid NOT NULL REFERENCES specimens(id) ON DELETE RESTRICT,
  report_number varchar(48) NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status varchar(24) NOT NULL DEFAULT 'Released' CHECK (status IN ('Released','Corrected','Superseded')),
  snapshot jsonb NOT NULL,
  released_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  correction_reason text,
  supersedes_id uuid REFERENCES lab_reports(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_number, version)
);
--> statement-breakpoint
CREATE INDEX lab_reports_specimen_idx ON lab_reports(specimen_id, released_at DESC);
--> statement-breakpoint
CREATE INDEX lab_reports_number_idx ON lab_reports(report_number, version DESC);
