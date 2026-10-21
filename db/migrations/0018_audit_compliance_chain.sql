-- Append-only, hash-chained audit log with filtered export support.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS chain_seq bigserial;
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS previous_hash varchar(64);
--> statement-breakpoint
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_hash varchar(64);
--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY occurred_at, id) AS seq
  FROM audit_events
)
UPDATE audit_events AS e SET chain_seq = ranked.seq FROM ranked WHERE ranked.id = e.id;
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('audit_events', 'chain_seq'), GREATEST(COALESCE((SELECT max(chain_seq) FROM audit_events), 1), 1), EXISTS (SELECT 1 FROM audit_events));
--> statement-breakpoint
DO $$
DECLARE item record; prior text := NULL; calculated text;
BEGIN
  FOR item IN SELECT * FROM audit_events ORDER BY chain_seq LOOP
    calculated := encode(digest(coalesce(prior, '') || (to_jsonb(item) - 'previous_hash' - 'event_hash' - 'chain_seq')::text, 'sha256'), 'hex');
    UPDATE audit_events SET previous_hash = prior, event_hash = calculated WHERE id = item.id;
    prior := calculated;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE audit_events ALTER COLUMN chain_seq SET NOT NULL;
--> statement-breakpoint
ALTER TABLE audit_events ALTER COLUMN event_hash SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS audit_events_chain_seq_uq ON audit_events(chain_seq);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_events_occurred_idx ON audit_events(occurred_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_events_append_only_guard() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only; UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_events_hash_on_insert() RETURNS trigger AS $$
DECLARE prior text;
BEGIN
  PERFORM pg_advisory_xact_lock(734921806);
  SELECT event_hash INTO prior FROM audit_events ORDER BY chain_seq DESC LIMIT 1;
  NEW.chain_seq := COALESCE((SELECT max(chain_seq) FROM audit_events), 0) + 1;
  NEW.previous_hash := prior;
  NEW.event_hash := encode(digest(coalesce(prior, '') || (to_jsonb(NEW) - 'previous_hash' - 'event_hash' - 'chain_seq')::text, 'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_append_only_trigger ON audit_events;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only_trigger BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_append_only_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_events_hash_insert_trigger ON audit_events;
--> statement-breakpoint
CREATE TRIGGER audit_events_hash_insert_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION audit_events_hash_on_insert();
