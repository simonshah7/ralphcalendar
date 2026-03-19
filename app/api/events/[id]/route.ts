import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  events,
  subEvents,
  eventAttendees,
  subEventAttendees,
  checklistItems,
  campaignEvents,
  campaigns,
  statuses,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { SubEvent, CampaignEvent, ChecklistItem, EventAttendee } from '@/db/schema';
import { logger } from '@/lib/logger';

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

    const subs = await db
      .select()
      .from(subEvents)
      .where(eq(subEvents.eventId, id));

    const attendees = await db
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, id));

    // Get sub-event attendee assignments
    const subAttendeeLinks = subs.length > 0
      ? await db
          .select()
          .from(subEventAttendees)
          .where(inArray(subEventAttendees.subEventId, subs.map((s: SubEvent) => s.id)))
      : [];

    const checklist = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.eventId, id));

    const campEvents = await db
      .select()
      .from(campaignEvents)
      .where(eq(campaignEvents.eventId, id));

    // Get linked campaign details
    const linkedCampaigns = campEvents.length > 0
      ? await db
          .select()
          .from(campaigns)
          .where(inArray(campaigns.id, campEvents.map((ce: CampaignEvent) => ce.campaignId)))
      : [];

    // Get status name
    let statusName = null;
    if (event.statusId) {
      const [status] = await db.select().from(statuses).where(eq(statuses.id, event.statusId));
      statusName = status?.name || null;
    }

    // Get prior event data for YoY comparison
    let priorEvent = null;
    if (event.priorEventId) {
      const [prior] = await db.select().from(events).where(eq(events.id, event.priorEventId));
      if (prior) {
        const priorAttendees = await db
          .select()
          .from(eventAttendees)
          .where(eq(eventAttendees.eventId, prior.id));
        const priorSubs = await db
          .select()
          .from(subEvents)
          .where(eq(subEvents.eventId, prior.id));
        const priorChecklist = await db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.eventId, prior.id));
        priorEvent = {
          ...prior,
          attendeeCount: priorAttendees.length,
          subEventCount: priorSubs.length,
          checklistTotal: priorChecklist.length,
          checklistDone: priorChecklist.filter((c: ChecklistItem) => c.isDone).length,
          allocatedPasses: priorAttendees.filter((a: EventAttendee) => a.hasPass).length,
        };
      }
    }

    return NextResponse.json({
      ...event,
      statusName,
      subEvents: subs,
      attendees,
      subEventAttendees: subAttendeeLinks,
      checklistItems: checklist,
      linkedCampaigns,
      priorEvent,
    });
  } catch (error) {
    logger.error('Error fetching event', error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'seriesName', 'startDate', 'endDate', 'location', 'venue',
      'statusId', 'totalPasses', 'description', 'priorEventId',
      'cost', 'actualCost', 'currency', 'region',
      'expectedSaos', 'actualSaos', 'pipelineGenerated', 'revenueGenerated',
      'slackWebhookUrl',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['cost', 'actualCost', 'expectedSaos', 'actualSaos', 'pipelineGenerated', 'revenueGenerated'].includes(field)) {
          updateData[field] = String(body[field]);
        } else if (field === 'title' && typeof body[field] === 'string') {
          updateData[field] = body[field].trim();
        } else {
          updateData[field] = body[field] || null;
        }
      }
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating event', error);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(events).where(eq(events.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting event', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
