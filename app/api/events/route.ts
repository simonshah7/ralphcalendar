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
import { eq } from 'drizzle-orm';
import type { Event, EventAttendee, ChecklistItem, SubEvent, CampaignEvent } from '@/db/schema';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allEvents: Event[] = await db
      .select()
      .from(events)
      .where(eq(events.calendarId, calendarId));

    // Enrich each event with counts
    const enriched = await Promise.all(
      allEvents.map(async (event) => {
        const attendees = await db
          .select()
          .from(eventAttendees)
          .where(eq(eventAttendees.eventId, event.id));
        const checklist = await db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.eventId, event.id));
        const subs = await db
          .select()
          .from(subEvents)
          .where(eq(subEvents.eventId, event.id));
        const campEvents = await db
          .select()
          .from(campaignEvents)
          .where(eq(campaignEvents.eventId, event.id));

        const allocatedPasses = attendees.filter((a: EventAttendee) => a.hasPass).length;
        const checklistTotal = checklist.length;
        const checklistDone = checklist.filter((c: ChecklistItem) => c.isDone).length;

        return {
          ...event,
          attendeeCount: attendees.length,
          internalCount: attendees.filter((a: EventAttendee) => a.attendeeType === 'internal').length,
          customerCount: attendees.filter((a: EventAttendee) => a.attendeeType === 'customer').length,
          allocatedPasses,
          subEventCount: subs.length,
          checklistTotal,
          checklistDone,
          campaignIds: campEvents.map((ce: CampaignEvent) => ce.campaignId),
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('Error fetching events:', error);
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

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
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
        currency: currency || 'US$',
        region: region || 'US',
        expectedSaos: expectedSaos !== undefined ? String(expectedSaos) : '0',
        actualSaos: actualSaos !== undefined ? String(actualSaos) : '0',
        pipelineGenerated: pipelineGenerated !== undefined ? String(pipelineGenerated) : '0',
        revenueGenerated: revenueGenerated !== undefined ? String(revenueGenerated) : '0',
      })
      .returning();

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
