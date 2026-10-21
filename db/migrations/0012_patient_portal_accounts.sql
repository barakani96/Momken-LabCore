CREATE TABLE patient_portal_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id uuid NOT NULL UNIQUE REFERENCES patients(id) ON DELETE RESTRICT,
 email varchar(254) NOT NULL UNIQUE,
 password_hash text,
 activation_token_hash varchar(64),
 activation_expires_at timestamptz,
 active boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 last_login_at timestamptz
);
CREATE INDEX patient_portal_accounts_active_idx ON patient_portal_accounts(active, email);
CREATE TABLE patient_portal_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES patient_portal_accounts(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_portal_sessions_account_idx ON patient_portal_sessions(account_id);
CREATE INDEX patient_portal_sessions_expiry_idx ON patient_portal_sessions(expires_at);
