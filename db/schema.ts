import { pgEnum, pgTable, text, timestamp, uuid, varchar, jsonb, index, uniqueIndex, integer, bigserial, numeric, boolean, date, char, bigint } from 'drizzle-orm/pg-core';

export const appRoleEnum = pgEnum('app_role', ['Admin', 'Lab Manager', 'Lab Scientist', 'Phlebotomist', 'Viewer']);
export const appUsers = pgTable('app_users', {
  id: uuid('id').defaultRandom().primaryKey(), email: varchar('email', { length: 254 }).notNull().unique(),
  displayName: varchar('display_name', { length: 160 }).notNull(), passwordHash: text('password_hash').notNull(),
  role: appRoleEnum('role').notNull().default('Viewer'), active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }), passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
});
export const appSessions = pgTable('app_sessions', {
  id: uuid('id').defaultRandom().primaryKey(), userId: uuid('user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userAgent: varchar('user_agent', { length: 500 }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('app_sessions_user_idx').on(table.userId), index('app_sessions_expiry_idx').on(table.expiresAt)]);
export const appPasswordRecoveryTokens = pgTable('app_password_recovery_tokens', {
  id: uuid('id').defaultRandom().primaryKey(), userId: uuid('user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('app_password_recovery_tokens_user_idx').on(table.userId, table.createdAt)]);

export const specimenStatusEnum = pgEnum('specimen_status', ['Collected', 'In progress', 'Pending review', 'Authorized', 'Rejected']);
export const labResultStatusEnum = pgEnum('lab_result_status', ['Needs entry', 'Entered', 'Technical review', 'Validated', 'Critical pending']);
export const priorityEnum = pgEnum('lab_priority', ['Routine', 'Urgent', 'STAT']);
export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(), patientNumber: varchar('patient_number', { length: 32 }).notNull().unique(),
  givenName: varchar('given_name', { length: 100 }).notNull(), familyName: varchar('family_name', { length: 100 }).notNull(),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true, mode: 'date' }), sexAtBirth: varchar('sex_at_birth', { length: 24 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
export const specimens = pgTable('specimens', {
  id: uuid('id').defaultRandom().primaryKey(), accession: varchar('accession', { length: 40 }).notNull().unique(),
  patientId: uuid('patient_id').notNull().references(() => patients.id), specimenType: varchar('specimen_type', { length: 100 }).notNull(),
  priority: priorityEnum('priority').default('Routine').notNull(), status: specimenStatusEnum('status').default('Collected').notNull(),
  department: varchar('department', { length: 120 }).notNull(), orderingClinician: varchar('ordering_clinician', { length: 160 }).notNull(),
  testCodes: jsonb('test_codes').$type<string[]>().notNull().default([]), collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('specimens_status_idx').on(table.status), index('specimens_collected_at_idx').on(table.collectedAt)]);
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(), actorId: varchar('actor_id', { length: 160 }).notNull(),
  action: varchar('action', { length: 80 }).notNull(), entityType: varchar('entity_type', { length: 80 }).notNull(),
  entityId: varchar('entity_id', { length: 160 }).notNull(), details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  chainSeq: bigserial('chain_seq', { mode: 'number' }).notNull(), previousHash: varchar('previous_hash', { length: 64 }), eventHash: varchar('event_hash', { length: 64 }).notNull().$defaultFn(() => '')
}, table => [index('audit_entity_idx').on(table.entityType, table.entityId), uniqueIndex('audit_events_chain_seq_uq').on(table.chainSeq), index('audit_events_occurred_idx').on(table.occurredAt)]);


// Versioned test definitions and order-management foundation (Increment 1.3).
export const catalogStatusEnum = pgEnum('catalog_status', ['Active', 'Inactive', 'Retired']);
export const orderStatusEnum = pgEnum('lab_order_status', ['Ordered', 'Collected', 'In progress', 'Cancelled']);
export const testCatalog = pgTable('test_catalog', {
  id: uuid('id').defaultRandom().primaryKey(), code: varchar('code', { length: 32 }).notNull(),
  version: varchar('version', { length: 24 }).notNull().default('1.0'), name: varchar('name', { length: 200 }).notNull(),
  department: varchar('department', { length: 120 }).notNull(), specimenType: varchar('specimen_type', { length: 100 }).notNull(),
  container: varchar('container', { length: 160 }).notNull(), method: varchar('method', { length: 160 }).notNull(),
  unit: varchar('unit', { length: 40 }), turnaroundHours: integer('turnaround_hours').notNull().default(4),
  status: catalogStatusEnum('status').notNull().default('Active'), effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('test_catalog_code_version_uq').on(table.code, table.version), index('test_catalog_department_idx').on(table.department), index('test_catalog_status_idx').on(table.status)]);
export const testPanels = pgTable('test_panels', {
  id: uuid('id').defaultRandom().primaryKey(), code: varchar('code', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(), description: text('description'), status: catalogStatusEnum('status').notNull().default('Active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
export const testPanelItems = pgTable('test_panel_items', {
  id: uuid('id').defaultRandom().primaryKey(), panelId: uuid('panel_id').notNull().references(() => testPanels.id),
  testId: uuid('test_id').notNull().references(() => testCatalog.id), sortOrder: integer('sort_order').notNull().default(0)
}, table => [index('test_panel_items_panel_idx').on(table.panelId), index('test_panel_items_test_idx').on(table.testId)]);
export const referenceIntervals = pgTable('reference_intervals', {
  id: uuid('id').defaultRandom().primaryKey(), testId: uuid('test_id').notNull().references(() => testCatalog.id),
  version: varchar('version', { length: 24 }).notNull().default('1.0'), population: varchar('population', { length: 120 }).notNull(),
  ageMinDays: integer('age_min_days'), ageMaxDays: integer('age_max_days'),
  sexAtBirth: varchar('sex_at_birth', { length: 24 }), lowValue: numeric('low_value', { precision: 18, scale: 6 }), highValue: numeric('high_value', { precision: 18, scale: 6 }),
  unit: varchar('unit', { length: 40 }).notNull(), effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }), source: text('source').notNull(),
  criticalLow: numeric('critical_low', { precision: 18, scale: 6 }), criticalHigh: numeric('critical_high', { precision: 18, scale: 6 }),
  approvalStatus: varchar('approval_status', { length: 24 }).notNull().default('Draft'), approvedBy: uuid('approved_by').references(() => appUsers.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }), supersedesId: uuid('supersedes_id'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('reference_intervals_test_idx').on(table.testId), index('reference_intervals_effective_idx').on(table.testId, table.approvalStatus, table.effectiveFrom, table.effectiveTo)]);
export const criticalResultNotifications = pgTable('critical_result_notifications', {
  id: uuid('id').defaultRandom().primaryKey(), resultId: uuid('result_id').notNull().references(() => labResults.id, { onDelete: 'restrict' }),
  notificationStatus: varchar('notification_status', { length: 24 }).notNull().default('Pending'), criticalDirection: varchar('critical_direction', { length: 16 }).notNull(),
  criticalValue: numeric('critical_value', { precision: 18, scale: 6 }).notNull(), unit: varchar('unit', { length: 40 }).notNull().default(''),
  triggeredBy: uuid('triggered_by').references(() => appUsers.id, { onDelete: 'set null' }), triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow().notNull(),
  notifiedTo: varchar('notified_to', { length: 160 }), notifiedBy: uuid('notified_by').references(() => appUsers.id, { onDelete: 'set null' }), notifiedAt: timestamp('notified_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }), communicationMethod: varchar('communication_method', { length: 40 }), communicationReference: text('communication_reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('critical_result_notifications_status_idx').on(table.notificationStatus, table.triggeredAt), index('critical_result_notifications_result_idx').on(table.resultId, table.triggeredAt)]);
export const labOrders = pgTable('lab_orders', {
  id: uuid('id').defaultRandom().primaryKey(), accession: varchar('accession', { length: 40 }).notNull().unique(),
  patientId: uuid('patient_id').notNull().references(() => patients.id), orderingClinician: varchar('ordering_clinician', { length: 160 }).notNull(),
  priority: priorityEnum('priority').notNull().default('Routine'), status: orderStatusEnum('status').notNull().default('Ordered'),
  specimenType: varchar('specimen_type', { length: 100 }).notNull(), orderedAt: timestamp('ordered_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: varchar('created_by', { length: 160 }).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('lab_orders_patient_idx').on(table.patientId), index('lab_orders_status_idx').on(table.status), index('lab_orders_ordered_at_idx').on(table.orderedAt)]);
export const labOrderItems = pgTable('lab_order_items', {
  id: uuid('id').defaultRandom().primaryKey(), orderId: uuid('order_id').notNull().references(() => labOrders.id),
  testId: uuid('test_id').notNull().references(() => testCatalog.id), testCodeSnapshot: varchar('test_code_snapshot', { length: 32 }).notNull(),
  testNameSnapshot: varchar('test_name_snapshot', { length: 200 }).notNull(), catalogVersionSnapshot: varchar('catalog_version_snapshot', { length: 24 }).notNull(),
  status: varchar('status', { length: 40 }).notNull().default('Ordered'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('lab_order_items_order_idx').on(table.orderId), index('lab_order_items_test_idx').on(table.testId)]);

// Links an order to the physical specimen created during accessioning.
export const orderAccessioning = pgTable('order_accessioning', {
  id: uuid('id').defaultRandom().primaryKey(), orderId: uuid('order_id').notNull().references(() => labOrders.id),
  specimenId: uuid('specimen_id').notNull().references(() => specimens.id), accessionedBy: varchar('accessioned_by', { length: 160 }).notNull(),
  accessionedAt: timestamp('accessioned_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('order_accessioning_order_uq').on(table.orderId), uniqueIndex('order_accessioning_specimen_uq').on(table.specimenId)]);

// Patient registry and immutable specimen lifecycle history (Increment 1.5).
export const specimenEvents = pgTable('specimen_events', {
  id: uuid('id').defaultRandom().primaryKey(), specimenId: uuid('specimen_id').notNull().references(() => specimens.id),
  eventType: varchar('event_type', { length: 64 }).notNull(), fromStatus: specimenStatusEnum('from_status'),
  toStatus: specimenStatusEnum('to_status').notNull(), reason: text('reason'), actorId: varchar('actor_id', { length: 160 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}), occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('specimen_events_specimen_idx').on(table.specimenId, table.occurredAt)]);

// Fine-grained user permissions and authentication event history (Increment 1.8).
export const userPermissionOverrides = pgTable('user_permission_overrides', {
  id: uuid('id').defaultRandom().primaryKey(), userId: uuid('user_id').notNull().references(() => appUsers.id, { onDelete: 'cascade' }),
  permissionKey: varchar('permission_key', { length: 120 }).notNull(), allowed: boolean('allowed').notNull(),
  grantedBy: uuid('granted_by').references(() => appUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('user_permission_overrides_user_permission_uq').on(table.userId, table.permissionKey), index('user_permission_overrides_user_idx').on(table.userId)]);
export const authEvents = pgTable('auth_events', {
  id: uuid('id').defaultRandom().primaryKey(), userId: uuid('user_id').references(() => appUsers.id, { onDelete: 'set null' }),
  emailAttempted: varchar('email_attempted', { length: 254 }), eventType: varchar('event_type', { length: 64 }).notNull(),
  outcome: varchar('outcome', { length: 24 }).notNull(), ipHash: varchar('ip_hash', { length: 64 }), userAgent: varchar('user_agent', { length: 400 }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('auth_events_occurred_idx').on(table.occurredAt), index('auth_events_user_idx').on(table.userId, table.occurredAt)]);

// Persistent login throttling buckets (Increment 1.9).
export const loginAttemptBuckets = pgTable('login_attempt_buckets', {
  bucketKey: varchar('bucket_key', { length: 64 }).primaryKey(), attempts: integer('attempts').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('login_attempt_buckets_blocked_idx').on(table.blockedUntil)]);


// Persistent result entry and two-stage review workflow (Increment 1.10).
export const labResults = pgTable('lab_results', {
  id: uuid('id').defaultRandom().primaryKey(), specimenId: uuid('specimen_id').notNull().references(() => specimens.id),
  testCode: varchar('test_code', { length: 32 }).notNull(), testName: varchar('test_name', { length: 200 }).notNull(),
  department: varchar('department', { length: 120 }).notNull(), value: numeric('value', { precision: 18, scale: 6 }), unit: varchar('unit', { length: 40 }).notNull().default(''),
  referenceLow: numeric('reference_low', { precision: 18, scale: 6 }), referenceHigh: numeric('reference_high', { precision: 18, scale: 6 }),
  criticalLow: numeric('critical_low', { precision: 18, scale: 6 }), criticalHigh: numeric('critical_high', { precision: 18, scale: 6 }),
  status: labResultStatusEnum('status').notNull().default('Needs entry'), enteredBy: uuid('entered_by').references(() => appUsers.id, { onDelete: 'set null' }),
  enteredAt: timestamp('entered_at', { withTimezone: true }), reviewedBy: uuid('reviewed_by').references(() => appUsers.id, { onDelete: 'set null' }), reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  validatedBy: uuid('validated_by').references(() => appUsers.id, { onDelete: 'set null' }), validatedAt: timestamp('validated_at', { withTimezone: true }), version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('lab_results_specimen_test_uq').on(table.specimenId, table.testCode), index('lab_results_status_idx').on(table.status, table.updatedAt), index('lab_results_specimen_idx').on(table.specimenId)]);
export const labResultEvents = pgTable('lab_result_events', {
  id: uuid('id').defaultRandom().primaryKey(), resultId: uuid('result_id').notNull().references(() => labResults.id), eventType: varchar('event_type', { length: 64 }).notNull(),
  actorId: varchar('actor_id', { length: 160 }).notNull(), fromStatus: labResultStatusEnum('from_status'), toStatus: labResultStatusEnum('to_status').notNull(),
  valueSnapshot: numeric('value_snapshot', { precision: 18, scale: 6 }), details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}), occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('lab_result_events_result_idx').on(table.resultId, table.occurredAt)]);


// Immutable released reports and governed correction versions (Increment 1.12).
export const labReports = pgTable('lab_reports', {
  id: uuid('id').defaultRandom().primaryKey(), specimenId: uuid('specimen_id').notNull().references(() => specimens.id, { onDelete: 'restrict' }),
  reportNumber: varchar('report_number', { length: 48 }).notNull(), version: integer('version').notNull().default(1),
  status: varchar('status', { length: 24 }).notNull().default('Released'), snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  releasedBy: uuid('released_by').references(() => appUsers.id, { onDelete: 'set null' }), releasedAt: timestamp('released_at', { withTimezone: true }).defaultNow().notNull(),
  correctionReason: text('correction_reason'), supersedesId: uuid('supersedes_id'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('lab_reports_number_version_uq').on(table.reportNumber, table.version), index('lab_reports_specimen_idx').on(table.specimenId, table.releasedAt), index('lab_reports_number_idx').on(table.reportNumber, table.version)]);


// Patient-facing report access grants. Only a SHA-256 token hash is persisted.
export const reportPortalGrants = pgTable('report_portal_grants', {
  id: uuid('id').defaultRandom().primaryKey(),
  reportId: uuid('report_id').notNull().references(() => labReports.id, { onDelete: 'restrict' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
}, table => [index('report_portal_grants_report_idx').on(table.reportId, table.createdAt), index('report_portal_grants_expiry_idx').on(table.expiresAt)]);

export const reportPortalAccessEvents = pgTable('report_portal_access_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  grantId: uuid('grant_id').references(() => reportPortalGrants.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  outcome: varchar('outcome', { length: 24 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }),
  userAgent: varchar('user_agent', { length: 500 }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('report_portal_access_events_grant_idx').on(table.grantId, table.occurredAt)]);


// Patient portal identities are isolated from employee accounts (Increment 1.14).
export const patientPortalAccounts = pgTable('patient_portal_accounts', {
  id: uuid('id').defaultRandom().primaryKey(), patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'restrict' }).unique(),
  email: varchar('email', { length: 254 }).notNull().unique(), passwordHash: text('password_hash'), activationTokenHash: varchar('activation_token_hash', { length: 64 }),
  activationExpiresAt: timestamp('activation_expires_at', { withTimezone: true }), active: boolean('active').notNull().default(false),
  createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(), lastLoginAt: timestamp('last_login_at', { withTimezone: true }), passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
}, table => [index('patient_portal_accounts_active_idx').on(table.active, table.email)]);
export const patientPortalSessions = pgTable('patient_portal_sessions', {
  id: uuid('id').defaultRandom().primaryKey(), accountId: uuid('account_id').notNull().references(() => patientPortalAccounts.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userAgent: varchar('user_agent', { length: 500 }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('patient_portal_sessions_account_idx').on(table.accountId), index('patient_portal_sessions_expiry_idx').on(table.expiresAt)]);

// Blood bank inventory and transfusion traceability (Increment 1.16).
export const bloodDonors = pgTable('blood_donors', {
  id: uuid('id').defaultRandom().primaryKey(), donorNumber: varchar('donor_number', { length: 32 }).notNull().unique(),
  givenName: varchar('given_name', { length: 100 }).notNull(), familyName: varchar('family_name', { length: 100 }).notNull(),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true, mode: 'date' }), bloodGroup: varchar('blood_group', { length: 3 }).notNull(),
  phone: varchar('phone', { length: 40 }), eligibilityStatus: varchar('eligibility_status', { length: 20 }).notNull().default('Pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_donors_group_idx').on(table.bloodGroup, table.eligibilityStatus)]);
export const bloodDonations = pgTable('blood_donations', {
  id: uuid('id').defaultRandom().primaryKey(), donationNumber: varchar('donation_number', { length: 40 }).notNull().unique(),
  donorId: uuid('donor_id').notNull().references(() => bloodDonors.id, { onDelete: 'restrict' }), collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
  collectionSite: varchar('collection_site', { length: 160 }).notNull(), screeningStatus: varchar('screening_status', { length: 20 }).notNull().default('Pending'),
  notes: text('notes'), createdBy: uuid('created_by').references(() => appUsers.id, { onDelete: 'set null' }), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_donations_donor_idx').on(table.donorId, table.collectedAt)]);
export const bloodUnits = pgTable('blood_units', {
  id: uuid('id').defaultRandom().primaryKey(), unitNumber: varchar('unit_number', { length: 48 }).notNull().unique(),
  donationId: uuid('donation_id').notNull().references(() => bloodDonations.id, { onDelete: 'restrict' }), componentType: varchar('component_type', { length: 40 }).notNull(),
  bloodGroup: varchar('blood_group', { length: 3 }).notNull(), collectedAt: timestamp('collected_at', { withTimezone: true }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  storageLocation: varchar('storage_location', { length: 120 }).notNull(), status: varchar('status', { length: 24 }).notNull().default('Quarantined'), screeningStatus: varchar('screening_status', { length: 20 }).notNull().default('Pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_units_inventory_idx').on(table.status, table.bloodGroup, table.componentType, table.expiresAt)]);
export const bloodTransfusionRequests = pgTable('blood_transfusion_requests', {
  id: uuid('id').defaultRandom().primaryKey(), requestNumber: varchar('request_number', { length: 40 }).notNull().unique(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'restrict' }), componentType: varchar('component_type', { length: 40 }).notNull(),
  unitsRequested: integer('units_requested').notNull().default(1), fulfilledUnits: integer('fulfilled_units').notNull().default(0), priority: varchar('priority', { length: 16 }).notNull().default('Routine'),
  status: varchar('status', { length: 20 }).notNull().default('Open'), requestedBy: uuid('requested_by').references(() => appUsers.id, { onDelete: 'set null' }),
  clinicalIndication: text('clinical_indication').notNull(), requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_transfusion_requests_patient_idx').on(table.patientId, table.requestedAt)]);
export const bloodCrossmatches = pgTable('blood_crossmatches', {
  id: uuid('id').defaultRandom().primaryKey(), crossmatchNumber: varchar('crossmatch_number', { length: 40 }).notNull().unique(),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'restrict' }), unitId: uuid('unit_id').notNull().references(() => bloodUnits.id, { onDelete: 'restrict' }),
  compatibilityStatus: varchar('compatibility_status', { length: 24 }).notNull().default('Pending'), performedBy: uuid('performed_by').references(() => appUsers.id, { onDelete: 'set null' }),
  performedAt: timestamp('performed_at', { withTimezone: true }), verifiedBy: uuid('verified_by').references(() => appUsers.id, { onDelete: 'set null' }), verifiedAt: timestamp('verified_at', { withTimezone: true }), requestId: uuid('request_id').references(() => bloodTransfusionRequests.id, { onDelete: 'restrict' }), notes: text('notes'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_crossmatches_patient_idx').on(table.patientId, table.createdAt)]);
export const bloodTransfusionEvents = pgTable('blood_transfusion_events', {
  id: uuid('id').defaultRandom().primaryKey(), crossmatchId: uuid('crossmatch_id').notNull().references(() => bloodCrossmatches.id, { onDelete: 'restrict' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'restrict' }), unitId: uuid('unit_id').notNull().references(() => bloodUnits.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).notNull().default('Planned'), startedAt: timestamp('started_at', { withTimezone: true }), completedAt: timestamp('completed_at', { withTimezone: true }),
  recordedBy: uuid('recorded_by').references(() => appUsers.id, { onDelete: 'set null' }), secondCheckerId: uuid('second_checker_id').references(() => appUsers.id, { onDelete: 'set null' }), requestId: uuid('request_id').references(() => bloodTransfusionRequests.id, { onDelete: 'restrict' }), issuedAt: timestamp('issued_at', { withTimezone: true }), stoppedAt: timestamp('stopped_at', { withTimezone: true }), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(), reactionNotes: text('reaction_notes'), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('blood_transfusion_patient_idx').on(table.patientId, table.createdAt)]);


// Quality Management System (Increment 1.22): controlled quality cases and immutable case history.
export const qualityCases = pgTable('quality_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseNumber: varchar('case_number', { length: 32 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  caseType: varchar('case_type', { length: 32 }).notNull(),
  severity: varchar('severity', { length: 16 }).notNull().default('Medium'),
  status: varchar('status', { length: 24 }).notNull().default('Open'),
  description: text('description').notNull(),
  source: varchar('source', { length: 80 }),
  linkedEntityType: varchar('linked_entity_type', { length: 80 }),
  linkedEntityId: varchar('linked_entity_id', { length: 160 }),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  preventiveAction: text('preventive_action'),
  effectivenessCheck: text('effectiveness_check'),
  ownerId: uuid('owner_id').references(() => appUsers.id, { onDelete: 'set null' }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => appUsers.id),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('quality_cases_status_idx').on(table.status), index('quality_cases_type_idx').on(table.caseType), index('quality_cases_due_idx').on(table.dueDate), index('quality_cases_created_idx').on(table.createdAt)]);
export const qualityCaseEvents = pgTable('quality_case_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').notNull().references(() => qualityCases.id, { onDelete: 'restrict' }),
  actorId: uuid('actor_id').notNull().references(() => appUsers.id),
  eventType: varchar('event_type', { length: 48 }).notNull(),
  fromStatus: varchar('from_status', { length: 24 }),
  toStatus: varchar('to_status', { length: 24 }),
  notes: text('notes'),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('quality_case_events_case_idx').on(table.caseId, table.occurredAt)]);

// Controlled documents and SOP lifecycle (Increment 1.23).
export const controlledDocuments = pgTable('controlled_documents', {
  id: uuid('id').defaultRandom().primaryKey(), documentCode: varchar('document_code', { length: 40 }).notNull().unique(),
  title: varchar('title', { length: 240 }).notNull(), documentType: varchar('document_type', { length: 32 }).notNull(),
  department: varchar('department', { length: 100 }), ownerId: uuid('owner_id').references(() => appUsers.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 24 }).notNull().default('Draft'), currentVersion: integer('current_version').notNull().default(1),
  effectiveAt: timestamp('effective_at', { withTimezone: true }), reviewDueAt: timestamp('review_due_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => appUsers.id), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('controlled_documents_status_idx').on(table.status), index('controlled_documents_review_due_idx').on(table.reviewDueAt)]);
export const controlledDocumentVersions = pgTable('controlled_document_versions', {
  id: uuid('id').defaultRandom().primaryKey(), documentId: uuid('document_id').notNull().references(() => controlledDocuments.id, { onDelete: 'restrict' }),
  versionNumber: integer('version_number').notNull(), content: text('content').notNull(), changeSummary: text('change_summary').notNull(),
  status: varchar('status', { length: 24 }).notNull().default('Draft'), submittedBy: uuid('submitted_by').references(() => appUsers.id, { onDelete: 'set null' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }), reviewedBy: uuid('reviewed_by').references(() => appUsers.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }), reviewComment: text('review_comment'), approvedAt: timestamp('approved_at', { withTimezone: true }),
  effectiveAt: timestamp('effective_at', { withTimezone: true }), createdBy: uuid('created_by').notNull().references(() => appUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('controlled_document_versions_unique_idx').on(table.documentId, table.versionNumber), index('controlled_document_versions_document_idx').on(table.documentId, table.versionNumber)]);
export const documentAcknowledgements = pgTable('document_acknowledgements', {
  id: uuid('id').defaultRandom().primaryKey(), documentId: uuid('document_id').notNull().references(() => controlledDocuments.id, { onDelete: 'restrict' }),
  versionNumber: integer('version_number').notNull(), userId: uuid('user_id').notNull().references(() => appUsers.id, { onDelete: 'restrict' }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('document_acknowledgements_unique_idx').on(table.documentId, table.versionNumber, table.userId), index('document_acknowledgements_user_idx').on(table.userId, table.acknowledgedAt)]);


// Inventory and reagent lot control (Increment 1.24).
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').defaultRandom().primaryKey(), itemCode: varchar('item_code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(), category: varchar('category', { length: 24 }).notNull(),
  unit: varchar('unit', { length: 24 }).notNull(), storageCondition: varchar('storage_condition', { length: 24 }).notNull(),
  reorderLevel: integer('reorder_level').notNull().default(0), supplier: varchar('supplier', { length: 160 }),
  active: boolean('active').notNull().default(true), createdBy: uuid('created_by').notNull().references(() => appUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('inventory_items_category_idx').on(table.category, table.active)]);
export const inventoryLots = pgTable('inventory_lots', {
  id: uuid('id').defaultRandom().primaryKey(), itemId: uuid('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'restrict' }),
  lotNumber: varchar('lot_number', { length: 80 }).notNull(), expiryDate: date('expiry_date', { mode: 'string' }).notNull(),
  receivedQty: integer('received_qty').notNull(), onHandQty: integer('on_hand_qty').notNull(), status: varchar('status', { length: 16 }).notNull().default('Available'),
  storageLocation: varchar('storage_location', { length: 100 }), receivedBy: uuid('received_by').notNull().references(() => appUsers.id),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [uniqueIndex('inventory_lots_item_lot_unique_idx').on(table.itemId, table.lotNumber), index('inventory_lots_expiry_idx').on(table.expiryDate)]);
export const inventoryMovements = pgTable('inventory_movements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(), lotId: uuid('lot_id').notNull().references(() => inventoryLots.id, { onDelete: 'restrict' }),
  itemId: uuid('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'restrict' }), movementType: varchar('movement_type', { length: 16 }).notNull(),
  quantityDelta: integer('quantity_delta').notNull(), balanceAfter: integer('balance_after').notNull(), reason: text('reason'), reference: varchar('reference', { length: 120 }),
  actorId: uuid('actor_id').notNull().references(() => appUsers.id), occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('inventory_movements_lot_idx').on(table.lotId, table.id), index('inventory_movements_item_time_idx').on(table.itemId, table.occurredAt)]);

// Procurement and purchase orders (Increment 1.25).
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(), poNumber: varchar('po_number', { length: 24 }).notNull().unique(),
  supplier: varchar('supplier', { length: 160 }).notNull(), currency: char('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('Draft'), createdBy: uuid('created_by').notNull().references(() => appUsers.id),
  approvedBy: uuid('approved_by').references(() => appUsers.id), approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('purchase_orders_status_idx').on(table.status, table.createdAt)]);
export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').defaultRandom().primaryKey(), orderId: uuid('order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  itemId: uuid('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'restrict' }), orderedQty: integer('ordered_qty').notNull(),
  receivedQty: integer('received_qty').notNull().default(0), unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull()
}, table => [uniqueIndex('purchase_order_lines_item_unique_idx').on(table.orderId, table.itemId)]);
export const purchaseOrderReceipts = pgTable('purchase_order_receipts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(), lineId: uuid('line_id').notNull().references(() => purchaseOrderLines.id, { onDelete: 'restrict' }),
  lotId: uuid('lot_id').notNull().references(() => inventoryLots.id, { onDelete: 'restrict' }), movementId: bigint('movement_id', { mode: 'number' }).notNull().references(() => inventoryMovements.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(), receivedBy: uuid('received_by').notNull().references(() => appUsers.id), receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull()
}, table => [index('purchase_order_receipts_line_idx').on(table.lineId, table.id)]);
