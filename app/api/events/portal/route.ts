import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, statuses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Event, Status } from '@/db/schema';
import { logger } from '@/lib/logger';

// Public read-only endpoint for the internal portal (Google Sites embed)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allEvents = await db
      .select()
      .from(events)
      .where(eq(events.calendarId, calendarId));

    const allStatuses = await db
      .select()
      .from(statuses)
      .where(eq(statuses.calendarId, calendarId));

    const statusMap = new Map(allStatuses.map((s: Status) => [s.id, s.name]));

    const portalEvents = allEvents.map((event: Event) => ({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      venue: event.venue,
      status: event.statusId ? statusMap.get(event.statusId) || null : null,
      description: event.description,
    }));

    // Sort by start date ascending
    portalEvents.sort((a: { startDate: string }, b: { startDate: string }) => a.startDate.localeCompare(b.startDate));

    return NextResponse.json({
      events: portalEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating portal feed', error);
    return NextResponse.json({ error: 'Failed to generate portal feed' }, { status: 500 });
  }
}
