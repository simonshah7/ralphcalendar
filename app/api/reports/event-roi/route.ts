import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, subEvents, eventAttendees, checklistItems, statuses, activities, campaignEvents, Event, SubEvent, EventAttendee, ChecklistItem, CampaignEvent } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json({ error: 'Valid eventId required' }, { status: 400 });
    }

    const [event]: Event[] = await db.select().from(events).where(eq(events.id, eventId));
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const subs: SubEvent[] = await db.select().from(subEvents).where(eq(subEvents.eventId, eventId));
    const attendees: EventAttendee[] = await db.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
    const checklist: ChecklistItem[] = await db.select().from(checklistItems).where(eq(checklistItems.eventId, eventId));

    let statusName: string | null = null;
    if (event.statusId) {
      const [status] = await db.select().from(statuses).where(eq(statuses.id, event.statusId));
      statusName = status?.name || null;
    }

    // Get linked activity metrics
    const linkedCampaignEvents: CampaignEvent[] = await db
      .select()
      .from(campaignEvents)
      .where(eq(campaignEvents.eventId, eventId));

    // Attendee stats
    const internal = attendees.filter((a) => a.attendeeType === 'internal');
    const customers = attendees.filter((a) => a.attendeeType === 'customer');
    const withPass = attendees.filter((a) => a.hasPass);
    const companies = new Set(customers.map((a) => a.company).filter(Boolean));

    const cost = num(event.cost);
    const actualCost = num(event.actualCost);
    const expectedSaos = num(event.expectedSaos);
    const actualSaos = num(event.actualSaos);
    const pipeline = num(event.pipelineGenerated);
    const revenue = num(event.revenueGenerated);

    const doneChecklist = checklist.filter((c) => c.isDone).length;
    const readinessPct = checklist.length > 0 ? doneChecklist / checklist.length : 0;

    // YoY: find prior event
    let priorEvent: Event | null = null;
    let priorMetrics = null;

    if (event.priorEventId) {
      const [prior] = await db.select().from(events).where(eq(events.id, event.priorEventId));
      if (prior) priorEvent = prior;
    } else if (event.seriesName) {
      // Find another event with same series name
      const seriesEvents: Event[] = await db
        .select()
        .from(events)
        .where(eq(events.seriesName, event.seriesName!));
      const priors = seriesEvents
        .filter((e) => e.id !== eventId && e.startDate < event.startDate)
        .sort((a, b) => (b.startDate > a.startDate ? 1 : -1));
      if (priors.length > 0) priorEvent = priors[0];
    }

    if (priorEvent) {
      const priorAttendees: EventAttendee[] = await db
        .select()
        .from(eventAttendees)
        .where(eq(eventAttendees.eventId, priorEvent.id));

      priorMetrics = {
        title: priorEvent.title,
        dates: `${priorEvent.startDate} - ${priorEvent.endDate}`,
        cost: num(priorEvent.cost),
        actualCost: num(priorEvent.actualCost),
        expectedSaos: num(priorEvent.expectedSaos),
        actualSaos: num(priorEvent.actualSaos),
        pipeline: num(priorEvent.pipelineGenerated),
        revenue: num(priorEvent.revenueGenerated),
        totalPasses: priorEvent.totalPasses,
        attendees: priorAttendees.length,
        roi: safeDiv(num(priorEvent.pipelineGenerated), num(priorEvent.actualCost)),
        costPerSao: safeDiv(num(priorEvent.actualCost), num(priorEvent.actualSaos)),
      };
    }

    // Recommendation logic
    const roi = safeDiv(pipeline, actualCost);
    const priorRoi = priorMetrics ? priorMetrics.roi : 0;
    let recommendation: 'invest' | 'maintain' | 'reduce' | 'cut' | 'new' = 'maintain';
    if (!priorMetrics) {
      recommendation = 'new';
    } else if (roi >= 3 && roi >= priorRoi) {
      recommendation = 'invest';
    } else if (roi >= 1) {
      recommendation = 'maintain';
    } else if (roi > 0 && roi < 1) {
      recommendation = 'reduce';
    } else if (actualCost > 0 && pipeline === 0) {
      recommendation = 'cut';
    }

    return NextResponse.json({
      event: {
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        venue: event.venue,
        statusName,
        seriesName: event.seriesName,
      },
      financial: {
        cost,
        actualCost,
        variance: cost - actualCost,
        pipeline,
        revenue,
        roi,
        costPerSao: safeDiv(actualCost, actualSaos),
      },
      saos: {
        expected: expectedSaos,
        actual: actualSaos,
      },
      attendees: {
        total: attendees.length,
        internal: internal.length,
        customers: customers.length,
        withPass: withPass.length,
        totalPasses: event.totalPasses,
        passUtilization: safeDiv(withPass.length, event.totalPasses || 0),
        companies: Array.from(companies),
      },
      subEvents: subs
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((se) => ({
          title: se.title,
          type: se.type,
          startDatetime: se.startDatetime,
          endDatetime: se.endDatetime,
          location: se.location,
        })),
      checklist: {
        total: checklist.length,
        done: doneChecklist,
        readinessPct,
      },
      priorEvent: priorMetrics,
      recommendation,
    });
  } catch (error) {
    logger.error('Error fetching event ROI data', error);
    return NextResponse.json({ error: 'Failed to fetch event ROI data' }, { status: 500 });
  }
}
