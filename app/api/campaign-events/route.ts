import { NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignEvents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const campaignId = searchParams.get('campaignId');

    if (eventId) {
      const items = await db.select().from(campaignEvents).where(eq(campaignEvents.eventId, eventId));
      return NextResponse.json(items);
    }
    if (campaignId) {
      const items = await db.select().from(campaignEvents).where(eq(campaignEvents.campaignId, campaignId));
      return NextResponse.json(items);
    }
    return NextResponse.json({ error: 'eventId or campaignId is required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching campaign-events:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign-events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { campaignId, eventId } = body;

    if (!campaignId || !eventId) {
      return NextResponse.json({ error: 'campaignId and eventId are required' }, { status: 400 });
    }

    // Check for existing link
    const existing = await db
      .select()
      .from(campaignEvents)
      .where(and(eq(campaignEvents.campaignId, campaignId), eq(campaignEvents.eventId, eventId)));

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Link already exists' }, { status: 409 });
    }

    const [created] = await db.insert(campaignEvents).values({ campaignId, eventId }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign-event link:', error);
    return NextResponse.json({ error: 'Failed to create link' }, { status: 500 });
  }
}
