import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }
    const items = await db.select().from(subEvents).where(eq(subEvents.eventId, eventId));
    return NextResponse.json(items);
  } catch (error) {
    logger.error('Error fetching sub-events', error);
    return NextResponse.json({ error: 'Failed to fetch sub-events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, title, type, startDatetime, endDatetime, location, description, sortOrder } = body;

    if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!startDatetime || !endDatetime) return NextResponse.json({ error: 'Start and end datetimes are required' }, { status: 400 });

    const [created] = await db.insert(subEvents).values({
      eventId,
      title: title.trim(),
      type: type?.trim() || null,
      startDatetime,
      endDatetime,
      location: location?.trim() || null,
      description: description?.trim() || null,
      sortOrder: sortOrder ?? 0,
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating sub-event', error);
    return NextResponse.json({ error: 'Failed to create sub-event' }, { status: 500 });
  }
}
