-- Increment 1.11: versioned, source-attributed reference intervals and critical-result communication.
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS critical_low numeric(18,6);
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS critical_high numeric(18,6);
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS approval_status varchar(24) NOT NULL DEFAULT 'Draft';
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE reference_intervals ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES reference_intervals(id) ON DELETE SET NULL;
ALTER TABLE reference_intervals ADD CONSTRAINT reference_intervals_approval_status_ck CHECK (approval_status IN ('Draft','Approved','Retired'));
ALTER TABLE reference_intervals ADD CONSTRAINT reference_intervals_age_range_ck CHECK (age_min_days IS NULL OR age_max_days IS NULL OR age_min_days <= age_max_days);
ALTER TABLE reference_intervals ADD CONSTRAINT reference_intervals_reference_range_ck CHECK (low_value IS NULL OR high_value IS NULL OR low_value <= high_value);
ALTER TABLE reference_intervals ADD CONSTRAINT reference_intervals_critical_range_ck CHECK (critical_low IS NULL OR critical_high IS NULL OR critical_low <= critical_high);
CREATE INDEX IF NOT EXISTS reference_intervals_effective_idx ON reference_intervals(test_id, approval_status, effective_from, effective_to);
CREATE TABLE IF NOT EXISTS critical_result_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), result_id uuid NOT NULL REFERENCES lab_results(id) ON DELETE RESTRICT,
  notification_status varchar(24) NOT NULL DEFAULT 'Pending', critical_direction varchar(16) NOT NULL,
  critical_value numeric(18,6) NOT NULL, unit varchar(40) NOT NULL DEFAULT '', triggered_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(), notified_to varchar(160), notified_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  notified_at timestamptz, acknowledged_at timestamptz, communication_method varchar(40), communication_reference text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT critical_result_status_ck CHECK (notification_status IN ('Pending','Notified','Acknowledged','Escalated','Cancelled')),
  CONSTRAINT critical_result_direction_ck CHECK (critical_direction IN ('Low','High'))
);
CREATE INDEX IF NOT EXISTS critical_result_notifications_status_idx ON critical_result_notifications(notification_status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS critical_result_notifications_result_idx ON critical_result_notifications(result_id, triggered_at DESC);
