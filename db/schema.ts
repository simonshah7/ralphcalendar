import { pgTable, uuid, text, timestamp, integer, decimal, date } from 'drizzle-orm/pg-core';

// Calendars table
export const calendars = pgTable('calendars', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Statuses table
export const statuses = pgTable('statuses', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').default(0),
});

// Swimlanes table
export const swimlanes = pgTable('swimlanes', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
});

// Campaigns table
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

// Activities table
export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  calendarId: uuid('calendar_id').notNull().references(() => calendars.id, { onDelete: 'cascade' }),
  swimlaneId: uuid('swimlane_id').notNull().references(() => swimlanes.id, { onDelete: 'cascade' }),
  statusId: uuid('status_id').notNull().references(() => statuses.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  description: text('description'),
  cost: decimal('cost', { precision: 12, scale: 2 }).default('0'),
  currency: text('currency').default('USD'),
  region: text('region').default('US'),
  tags: text('tags'),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow(),
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
