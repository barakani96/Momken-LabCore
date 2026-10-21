-- Controlled documents, revision history, approval and staff acknowledgement.
CREATE TABLE controlled_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_code varchar(40) NOT NULL UNIQUE,
 title varchar(240) NOT NULL,
 document_type varchar(32) NOT NULL CHECK (document_type IN ('SOP','Policy','Form','Work instruction','Manual')),
 department varchar(100), owner_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
 status varchar(24) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','In review','Approved','Obsolete')),
 current_version integer NOT NULL DEFAULT 1 CHECK (current_version > 0),
 effective_at timestamptz,
 review_due_at timestamptz,
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX controlled_documents_status_idx ON controlled_documents(status);
--> statement-breakpoint
CREATE INDEX controlled_documents_review_due_idx ON controlled_documents(review_due_at);
--> statement-breakpoint
CREATE TABLE controlled_document_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES controlled_documents(id) ON DELETE RESTRICT,
 version_number integer NOT NULL CHECK (version_number > 0),
 content text NOT NULL,
 change_summary text NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','In review','Approved','Rejected','Superseded')),
 submitted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
 submitted_at timestamptz,
 reviewed_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 review_comment text,
 approved_at timestamptz,
 effective_at timestamptz,
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX controlled_document_versions_unique_idx ON controlled_document_versions(document_id, version_number);
--> statement-breakpoint
CREATE INDEX controlled_document_versions_document_idx ON controlled_document_versions(document_id, version_number DESC);
--> statement-breakpoint
CREATE TABLE document_acknowledgements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES controlled_documents(id) ON DELETE RESTRICT,
 version_number integer NOT NULL,
 user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
 acknowledged_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX document_acknowledgements_unique_idx ON document_acknowledgements(document_id, version_number, user_id);
--> statement-breakpoint
CREATE INDEX document_acknowledgements_user_idx ON document_acknowledgements(user_id, acknowledged_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION controlled_document_versions_append_only_guard() RETURNS trigger AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'controlled document versions cannot be deleted'; END IF;
 IF NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.version_number IS DISTINCT FROM OLD.version_number OR NEW.content IS DISTINCT FROM OLD.content OR NEW.change_summary IS DISTINCT FROM OLD.change_summary OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'controlled document version content is immutable'; END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER controlled_document_versions_append_only_trigger BEFORE UPDATE OR DELETE ON controlled_document_versions FOR EACH ROW EXECUTE FUNCTION controlled_document_versions_append_only_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION document_acknowledgements_append_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'document acknowledgements are append-only'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER document_acknowledgements_append_only_trigger BEFORE UPDATE OR DELETE ON document_acknowledgements FOR EACH ROW EXECUTE FUNCTION document_acknowledgements_append_only_guard();
