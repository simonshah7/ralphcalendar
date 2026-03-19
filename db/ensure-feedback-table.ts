import { sql } from 'drizzle-orm';

let initialized = false;

export async function ensureFeedbackTable(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  if (initialized) return;

  try {
    // Create enums one at a time (Neon HTTP driver doesn't support multi-statement)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE feedback_category AS ENUM ('bug', 'suggestion', 'question', 'general');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE feedback_status AS ENUM ('new', 'in_progress', 'resolved', 'dismissed');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE feedback_priority AS ENUM ('low', 'medium', 'high', 'critical');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        screen_name TEXT NOT NULL,
        category feedback_category NOT NULL DEFAULT 'general',
        priority feedback_priority NOT NULL DEFAULT 'medium',
        status feedback_status NOT NULL DEFAULT 'new',
        content TEXT NOT NULL,
        tester_name TEXT,
        browser_info TEXT,
        url TEXT,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    initialized = true;
  } catch (error) {
    console.error('Error ensuring feedback table:', error);
  }
}
