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

// ─── Event Management Tables ────────────────────────────

export const attendeeTypeEnum = pgEnum('attendee_type', ['internal', 'customer']);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  seriesName: text('series_name'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  location: text('location'),
  venue: text('venue'),
  statusId: uuid('status_id').references(() => statuses.id),
  totalPasses: integer('total_passes').default(0),
  slackWebhookUrl: text('slack_webhook_url'),
  description: text('description'),
  priorEventId: uuid('prior_event_id'),
  cost: numeric('cost').default('0'),
  actualCost: numeric('actual_cost').default('0'),
  currency: currencyEnum('currency').default('USD'),
  region: regionEnum('region').default('US'),
  expectedSaos: numeric('expected_saos').default('0'),
  actualSaos: numeric('actual_saos').default('0'),
  pipelineGenerated: numeric('pipeline_generated').default('0'),
  revenueGenerated: numeric('revenue_generated').default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const subEvents = pgTable('sub_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  type: text('type'),
  startDatetime: text('start_datetime').notNull(),
  endDatetime: text('end_datetime').notNull(),
  location: text('location'),
  description: text('description'),
  calendarEventId: text('calendar_event_id'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const eventAttendees = pgTable('event_attendees', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  company: text('company'),
  attendeeType: attendeeTypeEnum('attendee_type').notNull(),
  role: text('role'),
  hasPass: boolean('has_pass').notNull().default(false),
  travelStatus: text('travel_status').default('not_booked'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subEventAttendees = pgTable('sub_event_attendees', {
  id: uuid('id').primaryKey().defaultRandom(),
  subEventId: uuid('sub_event_id')
    .notNull()
    .references(() => subEvents.id, { onDelete: 'cascade' }),
  attendeeId: uuid('attendee_id')
    .notNull()
    .references(() => eventAttendees.id, { onDelete: 'cascade' }),
});

export const checklistItems = pgTable('checklist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  isDone: boolean('is_done').notNull().default(false),
  category: text('category'),
  dueDate: text('due_date'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const campaignEvents = pgTable('campaign_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
});

// ─── Campaign Reporting Data ────────────────────────────

export const reportSourceEnum = pgEnum('report_source', [
  'marketo_theme',
  'marketo_channel',
  'hero_asset',
  'linkedin_ads',
  'icp_penetration',
  'outreach_sequence',
  'sfdc_event_leads',
]);

export const campaignReportData = pgTable('campaign_report_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id')
    .notNull()
    .references(() => calendars.id, { onDelete: 'cascade' }),
  source: reportSourceEnum('source').notNull(),
  category: text('category').notNull(),
  label: text('label').notNull(),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  metrics: jsonb('metrics').$type<Record<string, number>>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const adminSettings = pgTable('admin_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
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
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type SubEvent = typeof subEvents.$inferSelect;
export type NewSubEvent = typeof subEvents.$inferInsert;
export type EventAttendee = typeof eventAttendees.$inferSelect;
export type NewEventAttendee = typeof eventAttendees.$inferInsert;
export type SubEventAttendee = typeof subEventAttendees.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type CampaignEvent = typeof campaignEvents.$inferSelect;
export type CampaignReportData = typeof campaignReportData.$inferSelect;
export type NewCampaignReportData = typeof campaignReportData.$inferInsert;
export type AdminSetting = typeof adminSettings.$inferSelect;
