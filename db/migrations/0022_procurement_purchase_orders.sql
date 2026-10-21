-- Purchase orders, lines and append-only receipts that link to inventory lots.
CREATE SEQUENCE purchase_order_number_seq START 1;
--> statement-breakpoint
CREATE TABLE purchase_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 po_number varchar(24) NOT NULL UNIQUE,
 supplier varchar(160) NOT NULL,
 currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 status varchar(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved','Partially received','Received','Cancelled')),
 created_by uuid NOT NULL REFERENCES app_users(id),
 approved_by uuid REFERENCES app_users(id),
 approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT purchase_orders_author_not_approver CHECK (approved_by IS NULL OR approved_by <> created_by)
);
--> statement-breakpoint
CREATE INDEX purchase_orders_status_idx ON purchase_orders(status, created_at DESC);
--> statement-breakpoint
CREATE TABLE purchase_order_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
 ordered_qty integer NOT NULL CHECK (ordered_qty > 0),
 received_qty integer NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
 unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
 CONSTRAINT purchase_order_lines_no_over_receipt CHECK (received_qty <= ordered_qty)
);
--> statement-breakpoint
CREATE UNIQUE INDEX purchase_order_lines_item_unique_idx ON purchase_order_lines(order_id, item_id);
--> statement-breakpoint
CREATE TABLE purchase_order_receipts (
 id bigserial PRIMARY KEY,
 line_id uuid NOT NULL REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
 lot_id uuid NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
 movement_id bigint NOT NULL REFERENCES inventory_movements(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK (quantity > 0),
 received_by uuid NOT NULL REFERENCES app_users(id),
 received_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX purchase_order_receipts_line_idx ON purchase_order_receipts(line_id, id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purchase_order_receipts_append_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'purchase order receipts are append-only'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER purchase_order_receipts_append_only_trigger BEFORE UPDATE OR DELETE ON purchase_order_receipts FOR EACH ROW EXECUTE FUNCTION purchase_order_receipts_append_only_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION purchase_order_lines_guard() RETURNS trigger AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'purchase order lines cannot be deleted'; END IF;
 IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.ordered_qty IS DISTINCT FROM OLD.ordered_qty OR NEW.unit_price_minor IS DISTINCT FROM OLD.unit_price_minor THEN RAISE EXCEPTION 'purchase order line terms are immutable'; END IF;
 IF NEW.received_qty < OLD.received_qty THEN RAISE EXCEPTION 'received quantity cannot decrease'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER purchase_order_lines_guard_trigger BEFORE UPDATE OR DELETE ON purchase_order_lines FOR EACH ROW EXECUTE FUNCTION purchase_order_lines_guard();
