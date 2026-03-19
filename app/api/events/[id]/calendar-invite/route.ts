import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, eventAttendees, subEvents, adminSettings } from '@/db/schema';
import type { EventAttendee, SubEvent } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateICSForEvent } from '@/lib/ics';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch attendees with emails
    const attendees = await db
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, id));
    const attendeesWithEmails = attendees
      .filter((a: EventAttendee) => a.email)
      .map((a: EventAttendee) => ({ name: a.name, email: a.email! }));

    // Fetch sub-events
    const subs = await db
      .select()
      .from(subEvents)
      .where(eq(subEvents.eventId, id));

    // Fetch organizer settings
    const settingsRows = await db
      .select()
      .from(adminSettings)
      .where(
        inArray(adminSettings.key, [
          'calendar_organizer_name',
          'calendar_organizer_email',
        ])
      );
    const settingsMap = Object.fromEntries(
      settingsRows.map((s: { key: string; value: string | null }) => [s.key, s.value])
    );

    const icsContent = generateICSForEvent(
      {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        venue: event.venue,
        description: event.description,
      },
      attendeesWithEmails,
      {
        name: settingsMap.calendar_organizer_name || undefined,
        email: settingsMap.calendar_organizer_email || undefined,
      },
      subs.map((s: SubEvent) => ({
        id: s.id,
        title: s.title,
        startDatetime: s.startDatetime,
        endDatetime: s.endDatetime,
        location: s.location,
        description: s.description,
      }))
    );

    const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`;

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Error generating calendar invite', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar invite' },
      { status: 500 }
    );
  }
}
