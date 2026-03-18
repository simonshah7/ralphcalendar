-- Campaign Reporting Data table for multi-source campaign reporting
DO $$ BEGIN
  CREATE TYPE "report_source" AS ENUM (
    'marketo_theme',
    'marketo_channel',
    'hero_asset',
    'linkedin_ads',
    'icp_penetration',
    'outreach_sequence',
    'sfdc_event_leads'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "campaign_report_data" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "calendar_id" uuid NOT NULL REFERENCES "calendars"("id") ON DELETE CASCADE,
  "source" "report_source" NOT NULL,
  "category" text NOT NULL,
  "label" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "metrics" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
