CREATE TABLE blood_donors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donor_number varchar(32) NOT NULL UNIQUE,
  given_name varchar(100) NOT NULL, family_name varchar(100) NOT NULL,
  date_of_birth date, blood_group varchar(3) NOT NULL CHECK (blood_group IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  phone varchar(40), eligibility_status varchar(20) NOT NULL DEFAULT 'Pending' CHECK (eligibility_status IN ('Pending','Eligible','Deferred','Ineligible')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blood_donors_group_idx ON blood_donors(blood_group, eligibility_status);
CREATE TABLE blood_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), donation_number varchar(40) NOT NULL UNIQUE,
  donor_id uuid NOT NULL REFERENCES blood_donors(id) ON DELETE RESTRICT,
  collected_at timestamptz NOT NULL DEFAULT now(), collection_site varchar(160) NOT NULL,
  screening_status varchar(20) NOT NULL DEFAULT 'Pending' CHECK (screening_status IN ('Pending','Passed','Failed')),
  notes text, created_by uuid REFERENCES app_users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blood_donations_donor_idx ON blood_donations(donor_id, collected_at DESC);
CREATE TABLE blood_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unit_number varchar(48) NOT NULL UNIQUE,
  donation_id uuid NOT NULL REFERENCES blood_donations(id) ON DELETE RESTRICT,
  component_type varchar(40) NOT NULL CHECK (component_type IN ('Whole blood','Red cells','Platelets','Plasma','Cryoprecipitate')),
  blood_group varchar(3) NOT NULL CHECK (blood_group IN ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  collected_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  storage_location varchar(120) NOT NULL, status varchar(24) NOT NULL DEFAULT 'Quarantined' CHECK (status IN ('Quarantined','Available','Reserved','Issued','Transfused','Discarded','Expired')),
  screening_status varchar(20) NOT NULL DEFAULT 'Pending' CHECK (screening_status IN ('Pending','Passed','Failed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > collected_at)
);
CREATE INDEX blood_units_inventory_idx ON blood_units(status, blood_group, component_type, expires_at);
CREATE TABLE blood_crossmatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crossmatch_number varchar(40) NOT NULL UNIQUE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES blood_units(id) ON DELETE RESTRICT,
  compatibility_status varchar(24) NOT NULL DEFAULT 'Pending' CHECK (compatibility_status IN ('Pending','Compatible','Incompatible','Cancelled')),
  performed_by uuid REFERENCES app_users(id) ON DELETE SET NULL, performed_at timestamptz,
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blood_crossmatches_patient_idx ON blood_crossmatches(patient_id, created_at DESC);
CREATE TABLE blood_transfusion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), crossmatch_id uuid NOT NULL REFERENCES blood_crossmatches(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT, unit_id uuid NOT NULL REFERENCES blood_units(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned','Started','Completed','Reaction','Stopped')),
  started_at timestamptz, completed_at timestamptz, recorded_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reaction_notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blood_transfusion_patient_idx ON blood_transfusion_events(patient_id, created_at DESC);
