import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core';

// ─── JSONB Shape Interfaces ──────────────────────────────

export interface ActivityDependency {
  activityId: string;
  type: 'blocks' | 'blocked_by' | 'related';
}

export interface ActivityAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// ─── Enums ───────────────────────────────────────────────

export const campaignStatusEnum = pgEnum('campaign_status', [
  'Considering',
  'Negotiating',
  'Committed',
]);

export const currencyEnum = pgEnum('currency', ['USD', 'GBP', 'EUR']);

export const regionEnum = pgEnum('region', ['US', 'EMEA', 'ROW']);

export const userRoleEnum = pgEnum('user_role', ['User', 'Manager', 'Admin']);

export const accessTypeEnum = pgEnum('access_type', ['view', 'edit', 'copy']);

export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
  'none',
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
]);

// ─── Tables ──────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('User'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const calendars = pgTable('calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  isTemplate: boolean('is_template').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const calendarPermissions = pgTable('calendar_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  accessType: accessTypeEnum('access_type').notNull().default('view'),
});

export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const swimlanes = pgTable('swimlanes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  budget: numeric('budget'),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  sortOrder: numeric('sort_order').default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  budget: numeric('budget').default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activityTypes = pgTable('activity_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  swimlaneId: uuid('swimlane_id')
    .notNull()
    .references(() => swimlanes.id, { onDelete: 'cascade' }),
  statusId: uuid('status_id').references(() => statuses.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id, {
    onDelete: 'set null',
  }),
  typeId: uuid('type_id').references(() => activityTypes.id),
  vendorId: uuid('vendor_id').references(() => vendors.id),
  title: text('title').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  status: campaignStatusEnum('status').notNull().default('Considering'),
  description: text('description').default(''),
  tags: text('tags').default(''),
  cost: numeric('cost').default('0'),
  actualCost: numeric('actual_cost').default('0'),
  currency: currencyEnum('currency').default('USD'),
  region: regionEnum('region').default('US'),
  expectedSaos: numeric('expected_saos').default('0'),
  targetSaos: numeric('target_saos').default('0'),
  actualSaos: numeric('actual_saos').default('0'),
  pipelineGenerated: numeric('pipeline_generated').default('0'),
  revenueGenerated: numeric('revenue_generated').default('0'),
  dependencies: jsonb('dependencies').$type<ActivityDependency[]>().default([]),
  attachments: jsonb('attachments').$type<ActivityAttachment[]>().default([]),
  color: text('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  recurrenceFrequency: text('recurrence_frequency').notNull().default('none'),
  recurrenceEndDate: date('recurrence_end_date', { mode: 'string' }),
  recurrenceCount: numeric('recurrence_count'),
  parentActivityId: uuid('parent_activity_id'),
  isRecurrenceParent: boolean('is_recurrence_parent').notNull().default(false),
  slackChannel: text('slack_channel'),
  outline: text('outline'),
});

export const activityComments = pgTable('activity_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  activityId: uuid('activity_id')
    .notNull()
    .references(() => activities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activityHistory = pgTable('activity_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  activityId: uuid('activity_id')
    .notNull()
    .references(() => activities.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  fieldName: text('field_name').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Type exports ────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;
export type CalendarPermission = typeof calendarPermissions.$inferSelect;
export type Status = typeof statuses.$inferSelect;
export type NewStatus = typeof statuses.$inferInsert;
export type Swimlane = typeof swimlanes.$inferSelect;
export type NewSwimlane = typeof swimlanes.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type ActivityType = typeof activityTypes.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type ActivityComment = typeof activityComments.$inferSelect;
export type ActivityHistoryEntry = typeof activityHistory.$inferSelect;
