import { NextResponse } from 'next/server';
import { db, calendars, statuses, swimlanes, campaigns, activities } from '@/db';
import { eq, asc, InferSelectModel } from 'drizzle-orm';

type Calendar = InferSelectModel<typeof calendars>;
type Status = InferSelectModel<typeof statuses>;
type Swimlane = InferSelectModel<typeof swimlanes>;
type Campaign = InferSelectModel<typeof campaigns>;
type Activity = InferSelectModel<typeof activities>;
import { DEFAULT_STATUSES } from '@/lib/utils';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [calendar]: Calendar[] = await db.select().from(calendars).where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    let calendarStatuses: Status[] = await db
      .select()
      .from(statuses)
      .where(eq(statuses.calendarId, id))
      .orderBy(asc(statuses.sortOrder));

    // If no statuses exist, create default ones
    if (calendarStatuses.length === 0) {
      const statusValues = DEFAULT_STATUSES.map((status, index) => ({
        calendarId: id,
        name: status.name,
        color: status.color,
        sortOrder: index,
      }));
      calendarStatuses = await db.insert(statuses).values(statusValues).returning();
    }

    const calendarSwimlanes: Swimlane[] = await db
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.calendarId, id))
      .orderBy(asc(swimlanes.sortOrder));
    const calendarCampaigns: Campaign[] = await db.select().from(campaigns).where(eq(campaigns.calendarId, id));
    const calendarActivities: Activity[] = await db.select().from(activities).where(eq(activities.calendarId, id));

    return NextResponse.json({
      ...calendar,
      statuses: calendarStatuses,
      swimlanes: calendarSwimlanes,
      campaigns: calendarCampaigns,
      activities: calendarActivities,
    });
  } catch (error) {
    logger.error('Error fetching calendar', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [updated] = await db
      .update(calendars)
      .set({ name: name.trim() })
      .where(eq(calendars.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating calendar', error);
    return NextResponse.json({ error: 'Failed to update calendar' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(calendars).where(eq(calendars.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting calendar', error);
    return NextResponse.json({ error: 'Failed to delete calendar' }, { status: 500 });
  }
}
