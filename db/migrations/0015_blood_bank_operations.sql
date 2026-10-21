-- Blood bank operations: patient-linked requests, two-person crossmatch verification, and controlled issue.
CREATE TABLE blood_transfusion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number varchar(40) NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  component_type varchar(40) NOT NULL CHECK (component_type IN ('Whole blood','Red cells','Platelets','Plasma','Cryoprecipitate')),
  units_requested integer NOT NULL DEFAULT 1 CHECK (units_requested BETWEEN 1 AND 20),
  fulfilled_units integer NOT NULL DEFAULT 0 CHECK (fulfilled_units BETWEEN 0 AND units_requested),
  priority varchar(16) NOT NULL DEFAULT 'Routine' CHECK (priority IN ('Routine','Urgent','STAT')),
  status varchar(20) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Partially fulfilled','Fulfilled','Cancelled')),
  requested_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  clinical_indication text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blood_transfusion_requests_patient_idx ON blood_transfusion_requests(patient_id, requested_at DESC);
ALTER TABLE blood_crossmatches ADD COLUMN verified_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE blood_crossmatches ADD COLUMN verified_at timestamptz;
ALTER TABLE blood_crossmatches ADD COLUMN request_id uuid REFERENCES blood_transfusion_requests(id) ON DELETE RESTRICT;
ALTER TABLE blood_transfusion_events ADD COLUMN request_id uuid REFERENCES blood_transfusion_requests(id) ON DELETE RESTRICT;
ALTER TABLE blood_transfusion_events ADD COLUMN second_checker_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE blood_transfusion_events ADD COLUMN issued_at timestamptz;
ALTER TABLE blood_transfusion_events ADD COLUMN stopped_at timestamptz;
ALTER TABLE blood_transfusion_events ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX blood_transfusion_active_unit_uq ON blood_transfusion_events(unit_id) WHERE status IN ('Planned','Started','Reaction');
CREATE INDEX blood_crossmatches_request_idx ON blood_crossmatches(request_id, created_at DESC);
