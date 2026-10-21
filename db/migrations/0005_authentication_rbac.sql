CREATE TYPE app_role AS ENUM ('Admin', 'Lab Manager', 'Lab Scientist', 'Phlebotomist', 'Viewer');
--> statement-breakpoint
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL UNIQUE,
  display_name varchar(160) NOT NULL,
  password_hash text NOT NULL,
  role app_role NOT NULL DEFAULT 'Viewer',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
--> statement-breakpoint
CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX app_sessions_user_idx ON app_sessions(user_id);
--> statement-breakpoint
CREATE INDEX app_sessions_expiry_idx ON app_sessions(expires_at);
