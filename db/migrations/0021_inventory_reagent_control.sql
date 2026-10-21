-- Inventory and reagent lot control: item master, expiry-tracked lots and an append-only stock ledger.
CREATE TABLE inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_code varchar(40) NOT NULL UNIQUE,
 name varchar(200) NOT NULL,
 category varchar(24) NOT NULL CHECK (category IN ('Reagent','Calibrator','Control','Consumable','Kit')),
 unit varchar(24) NOT NULL,
 storage_condition varchar(24) NOT NULL CHECK (storage_condition IN ('Room temperature','2-8 C','-20 C','-80 C')),
 reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
 supplier varchar(160),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX inventory_items_category_idx ON inventory_items(category, active);
--> statement-breakpoint
CREATE TABLE inventory_lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
 lot_number varchar(80) NOT NULL,
 expiry_date date NOT NULL,
 received_qty integer NOT NULL CHECK (received_qty > 0),
 on_hand_qty integer NOT NULL CHECK (on_hand_qty >= 0),
 status varchar(16) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Quarantined','Depleted','Discarded')),
 storage_location varchar(100),
 received_by uuid NOT NULL REFERENCES app_users(id),
 received_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX inventory_lots_item_lot_unique_idx ON inventory_lots(item_id, lot_number);
--> statement-breakpoint
CREATE INDEX inventory_lots_fefo_idx ON inventory_lots(item_id, expiry_date, received_at) WHERE status = 'Available' AND on_hand_qty > 0;
--> statement-breakpoint
CREATE INDEX inventory_lots_expiry_idx ON inventory_lots(expiry_date);
--> statement-breakpoint
CREATE TABLE inventory_movements (
 id bigserial PRIMARY KEY,
 lot_id uuid NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
 item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
 movement_type varchar(16) NOT NULL CHECK (movement_type IN ('receive','consume','adjust','discard','quarantine','release')),
 quantity_delta integer NOT NULL,
 balance_after integer NOT NULL CHECK (balance_after >= 0),
 reason text,
 reference varchar(120),
 actor_id uuid NOT NULL REFERENCES app_users(id),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT inventory_movements_reason_required CHECK (movement_type NOT IN ('adjust','discard','quarantine','release') OR length(btrim(coalesce(reason, ''))) >= 3),
 CONSTRAINT inventory_movements_delta_sign CHECK ((movement_type = 'receive' AND quantity_delta > 0) OR (movement_type IN ('consume','discard') AND quantity_delta < 0) OR (movement_type = 'adjust' AND quantity_delta <> 0) OR (movement_type IN ('quarantine','release') AND quantity_delta = 0))
);
--> statement-breakpoint
CREATE INDEX inventory_movements_lot_idx ON inventory_movements(lot_id, id);
--> statement-breakpoint
CREATE INDEX inventory_movements_item_time_idx ON inventory_movements(item_id, occurred_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION inventory_movements_append_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'inventory movements are append-only'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER inventory_movements_append_only_trigger BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION inventory_movements_append_only_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION inventory_lots_identity_guard() RETURNS trigger AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'inventory lots cannot be deleted'; END IF;
 IF NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.lot_number IS DISTINCT FROM OLD.lot_number OR NEW.expiry_date IS DISTINCT FROM OLD.expiry_date OR NEW.received_qty IS DISTINCT FROM OLD.received_qty OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN RAISE EXCEPTION 'inventory lot identity is immutable'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER inventory_lots_identity_trigger BEFORE UPDATE OR DELETE ON inventory_lots FOR EACH ROW EXECUTE FUNCTION inventory_lots_identity_guard();
