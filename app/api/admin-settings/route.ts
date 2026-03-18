import { NextResponse } from 'next/server';
import { db } from '@/db';
import { adminSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const settings = await db.select().from(adminSettings);
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return NextResponse.json(map);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 });

    const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key));

    if (existing.length > 0) {
      const [updated] = await db
        .update(adminSettings)
        .set({ value: value ?? '', updatedAt: new Date() })
        .where(eq(adminSettings.key, key))
        .returning();
      return NextResponse.json(updated);
    } else {
      const [created] = await db
        .insert(adminSettings)
        .values({ key, value: value ?? '' })
        .returning();
      return NextResponse.json(created, { status: 201 });
    }
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
