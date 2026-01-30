import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Calendars table
export const calendars = sqliteTable('calendars', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Statuses table
export const statuses = sqliteTable('statuses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').default(0),
});

// Swimlanes table
export const swimlanes = sqliteTable('swimlanes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
});

// Campaigns table
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

// Activities table
export const activities = sqliteTable('activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  calendarId: text('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  swimlaneId: text('swimlane_id').notNull().references(() => swimlanes.id, { onDelete: 'cascade' }),
  statusId: text('status_id').notNull().references(() => statuses.id),
  campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  description: text('description'),
  cost: real('cost').default(0),
  currency: text('currency').default('USD'),
  region: text('region').default('US'),
  tags: text('tags'),
  color: text('color'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Type exports
export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;
export type Status = typeof statuses.$inferSelect;
export type NewStatus = typeof statuses.$inferInsert;
export type Swimlane = typeof swimlanes.$inferSelect;
export type NewSwimlane = typeof swimlanes.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
