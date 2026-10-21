CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TYPE specimen_status AS ENUM ('Collected', 'In progress', 'Pending review', 'Authorized', 'Rejected');
--> statement-breakpoint
CREATE TYPE lab_priority AS ENUM ('Routine', 'Urgent', 'STAT');
--> statement-breakpoint
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_number varchar(32) NOT NULL UNIQUE,
  given_name varchar(100) NOT NULL,
  family_name varchar(100) NOT NULL,
  date_of_birth timestamptz,
  sex_at_birth varchar(24),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE specimens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accession varchar(40) NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id),
  specimen_type varchar(100) NOT NULL,
  priority lab_priority NOT NULL DEFAULT 'Routine',
  status specimen_status NOT NULL DEFAULT 'Collected',
  department varchar(120) NOT NULL,
  ordering_clinician varchar(160) NOT NULL,
  test_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX specimens_status_idx ON specimens(status);
--> statement-breakpoint
CREATE INDEX specimens_collected_at_idx ON specimens(collected_at);
--> statement-breakpoint
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar(160) NOT NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(160) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX audit_entity_idx ON audit_events(entity_type, entity_id);
