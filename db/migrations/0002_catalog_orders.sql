-- Increment 1.3 catalog and order foundation. Review and apply with the project's migration process.
CREATE TYPE catalog_status AS ENUM ('Active', 'Inactive', 'Retired');
--> statement-breakpoint
CREATE TYPE lab_order_status AS ENUM ('Ordered', 'Collected', 'In progress', 'Cancelled');
--> statement-breakpoint
CREATE TABLE test_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(32) NOT NULL, version varchar(24) NOT NULL DEFAULT '1.0',
  name varchar(200) NOT NULL, department varchar(120) NOT NULL, specimen_type varchar(100) NOT NULL, container varchar(160) NOT NULL,
  method varchar(160) NOT NULL, unit varchar(40), turnaround_hours integer NOT NULL DEFAULT 4, status catalog_status NOT NULL DEFAULT 'Active',
  effective_from timestamptz NOT NULL DEFAULT now(), effective_to timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX test_catalog_code_version_uq ON test_catalog(code, version);
--> statement-breakpoint
CREATE INDEX test_catalog_department_idx ON test_catalog(department);
--> statement-breakpoint
CREATE INDEX test_catalog_status_idx ON test_catalog(status);
--> statement-breakpoint
CREATE TABLE test_panels (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(32) NOT NULL UNIQUE, name varchar(200) NOT NULL, description text, status catalog_status NOT NULL DEFAULT 'Active', created_at timestamptz NOT NULL DEFAULT now());
--> statement-breakpoint
CREATE TABLE test_panel_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), panel_id uuid NOT NULL REFERENCES test_panels(id), test_id uuid NOT NULL REFERENCES test_catalog(id), sort_order integer NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE INDEX test_panel_items_panel_idx ON test_panel_items(panel_id);
--> statement-breakpoint
CREATE INDEX test_panel_items_test_idx ON test_panel_items(test_id);
--> statement-breakpoint
CREATE TABLE reference_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), test_id uuid NOT NULL REFERENCES test_catalog(id), version varchar(24) NOT NULL DEFAULT '1.0', population varchar(120) NOT NULL,
  age_min_days integer, age_max_days integer, sex_at_birth varchar(24), low_value numeric(18,6), high_value numeric(18,6), unit varchar(40) NOT NULL,
  effective_from timestamptz NOT NULL, effective_to timestamptz, source text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX reference_intervals_test_idx ON reference_intervals(test_id);
--> statement-breakpoint
CREATE TABLE lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), accession varchar(40) NOT NULL UNIQUE, patient_id uuid NOT NULL REFERENCES patients(id), ordering_clinician varchar(160) NOT NULL,
  priority lab_priority NOT NULL DEFAULT 'Routine', status lab_order_status NOT NULL DEFAULT 'Ordered', specimen_type varchar(100) NOT NULL, ordered_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(160) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX lab_orders_patient_idx ON lab_orders(patient_id);
--> statement-breakpoint
CREATE INDEX lab_orders_status_idx ON lab_orders(status);
--> statement-breakpoint
CREATE INDEX lab_orders_ordered_at_idx ON lab_orders(ordered_at);
--> statement-breakpoint
CREATE TABLE lab_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES lab_orders(id), test_id uuid NOT NULL REFERENCES test_catalog(id),
  test_code_snapshot varchar(32) NOT NULL, test_name_snapshot varchar(200) NOT NULL, catalog_version_snapshot varchar(24) NOT NULL, status varchar(40) NOT NULL DEFAULT 'Ordered', created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX lab_order_items_order_idx ON lab_order_items(order_id);
--> statement-breakpoint
CREATE INDEX lab_order_items_test_idx ON lab_order_items(test_id);
--> statement-breakpoint
