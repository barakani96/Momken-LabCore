-- Increment 1.4: durable order creation and accessioning. Apply after the base schema and 0002_catalog_orders.sql.
-- Sequences are concurrency-safe; gaps are expected and must not be reused.
CREATE SEQUENCE IF NOT EXISTS lab_accession_seq START WITH 100000 INCREMENT BY 1 NO CYCLE;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS order_accessioning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES lab_orders(id),
  specimen_id uuid NOT NULL REFERENCES specimens(id),
  accessioned_by varchar(160) NOT NULL,
  accessioned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_accessioning_order_uq UNIQUE (order_id),
  CONSTRAINT order_accessioning_specimen_uq UNIQUE (specimen_id)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS order_accessioning_accessioned_at_idx ON order_accessioning(accessioned_at);
--> statement-breakpoint
