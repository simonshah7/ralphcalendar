import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  events,
  subEvents,
  eventAttendees,
  checklistItems,
  campaignEvents,
  campaigns,
  statuses,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { Event, EventAttendee, ChecklistItem, SubEvent, CampaignEvent } from '@/db/schema';
import { isValidUUID } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId || !isValidUUID(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId is required' }, { status: 400 });
    }

    const allEvents: Event[] = await db
      .select()
      .from(events)
      .where(eq(events.calendarId, calendarId));

    if (allEvents.length === 0) {
      return NextResponse.json([]);
    }

    // Batch-fetch all related data in 4 queries instead of 4N
    const eventIds = allEvents.map((e) => e.id);

    const [allAttendees, allChecklist, allSubs, allCampEvents] = await Promise.all([
      db.select().from(eventAttendees).where(inArray(eventAttendees.eventId, eventIds)),
      db.select().from(checklistItems).where(inArray(checklistItems.eventId, eventIds)),
      db.select().from(subEvents).where(inArray(subEvents.eventId, eventIds)),
      db.select().from(campaignEvents).where(inArray(campaignEvents.eventId, eventIds)),
    ]);

    // Group by eventId for O(1) lookup
    const attendeesByEvent = new Map<string, EventAttendee[]>();
    for (const a of allAttendees) {
      const list = attendeesByEvent.get(a.eventId) || [];
      list.push(a);
      attendeesByEvent.set(a.eventId, list);
    }

    const checklistByEvent = new Map<string, ChecklistItem[]>();
    for (const c of allChecklist) {
      const list = checklistByEvent.get(c.eventId) || [];
      list.push(c);
      checklistByEvent.set(c.eventId, list);
    }

    const subsByEvent = new Map<string, SubEvent[]>();
    for (const s of allSubs) {
      const list = subsByEvent.get(s.eventId) || [];
      list.push(s);
      subsByEvent.set(s.eventId, list);
    }

    const campEventsByEvent = new Map<string, CampaignEvent[]>();
    for (const ce of allCampEvents) {
      const list = campEventsByEvent.get(ce.eventId) || [];
      list.push(ce);
      campEventsByEvent.set(ce.eventId, list);
    }

    const enriched = allEvents.map((event) => {
      const attendees = attendeesByEvent.get(event.id) || [];
      const checklist = checklistByEvent.get(event.id) || [];
      const subs = subsByEvent.get(event.id) || [];
      const campEvents = campEventsByEvent.get(event.id) || [];

      return {
        ...event,
        attendeeCount: attendees.length,
        internalCount: attendees.filter((a) => a.attendeeType === 'internal').length,
        customerCount: attendees.filter((a) => a.attendeeType === 'customer').length,
        allocatedPasses: attendees.filter((a) => a.hasPass).length,
        subEventCount: subs.length,
        checklistTotal: checklist.length,
        checklistDone: checklist.filter((c) => c.isDone).length,
        campaignIds: campEvents.map((ce) => ce.campaignId),
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    logger.error('Error fetching events', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
      title,
      seriesName,
      startDate,
      endDate,
      location,
      venue,
      statusId,
      totalPasses,
      description,
      priorEventId,
      cost,
      actualCost,
      currency,
      region,
      expectedSaos,
      actualSaos,
      pipelineGenerated,
      revenueGenerated,
    } = body;

    if (!calendarId || !isValidUUID(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId is required' }, { status: 400 });
    }
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: 'End date must be after or equal to start date' }, { status: 400 });
    }

    const [newEvent] = await db
      .insert(events)
      .values({
        calendarId,
        title: title.trim(),
        seriesName: seriesName?.trim() || null,
        startDate,
        endDate,
        location: location?.trim() || null,
        venue: venue?.trim() || null,
        statusId: statusId || null,
        totalPasses: totalPasses ?? 0,
        description: description?.trim() || null,
        priorEventId: priorEventId || null,
        cost: cost !== undefined ? String(cost) : '0',
        actualCost: actualCost !== undefined ? String(actualCost) : '0',
        currency: currency || 'USD',
        region: region || 'US',
        expectedSaos: expectedSaos !== undefined ? String(expectedSaos) : '0',
        actualSaos: actualSaos !== undefined ? String(actualSaos) : '0',
        pipelineGenerated: pipelineGenerated !== undefined ? String(pipelineGenerated) : '0',
        revenueGenerated: revenueGenerated !== undefined ? String(revenueGenerated) : '0',
      })
      .returning();

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    logger.error('Error creating event', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
