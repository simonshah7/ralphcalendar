CREATE TABLE IF NOT EXISTS "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "swimlanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
	"name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
	"swimlane_id" uuid NOT NULL REFERENCES "swimlanes"("id") ON DELETE CASCADE,
	"status_id" uuid NOT NULL REFERENCES "statuses"("id"),
	"campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL,
	"title" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"description" text,
	"cost" double precision DEFAULT 0,
	"currency" text DEFAULT 'USD',
	"region" text DEFAULT 'US',
	"tags" text,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
