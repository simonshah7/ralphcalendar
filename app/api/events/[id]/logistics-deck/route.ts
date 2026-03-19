import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, subEvents, eventAttendees, checklistItems, statuses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SubEvent, EventAttendee, ChecklistItem } from '@/db/schema';
import { logger } from '@/lib/logger';

// Returns structured data for PPTX generation on the client side
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const subs = await db.select().from(subEvents).where(eq(subEvents.eventId, id));
    const attendees = await db.select().from(eventAttendees).where(eq(eventAttendees.eventId, id));
    const checklist = await db.select().from(checklistItems).where(eq(checklistItems.eventId, id));

    let statusName = null;
    if (event.statusId) {
      const [status] = await db.select().from(statuses).where(eq(statuses.id, event.statusId));
      statusName = status?.name || null;
    }

    return NextResponse.json({
      event: { ...event, statusName },
      subEvents: subs.sort((a: SubEvent, b: SubEvent) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      attendees: {
        internal: attendees.filter((a: EventAttendee) => a.attendeeType === 'internal'),
        customers: attendees.filter((a: EventAttendee) => a.attendeeType === 'customer'),
      },
      checklist: checklist.sort((a: ChecklistItem, b: ChecklistItem) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      passAllocation: {
        total: event.totalPasses,
        allocated: attendees.filter((a: EventAttendee) => a.hasPass).length,
      },
    });
  } catch (error) {
    logger.error('Error fetching logistics data', error);
    return NextResponse.json({ error: 'Failed to fetch logistics data' }, { status: 500 });
  }
}
