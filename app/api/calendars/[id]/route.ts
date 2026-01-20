import { NextResponse } from 'next/server';
import { db, calendars, statuses, swimlanes, campaigns, activities } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [calendar] = await db.select().from(calendars).where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json({ error: 'Calendar not found' }, { status: 404 });
    }

    const calendarStatuses = await db.select().from(statuses).where(eq(statuses.calendarId, id));
    const calendarSwimlanes = await db.select().from(swimlanes).where(eq(swimlanes.calendarId, id));
    const calendarCampaigns = await db.select().from(campaigns).where(eq(campaigns.calendarId, id));
    const calendarActivities = await db.select().from(activities).where(eq(activities.calendarId, id));

    return NextResponse.json({
      ...calendar,
      statuses: calendarStatuses,
      swimlanes: calendarSwimlanes,
      campaigns: calendarCampaigns,
      activities: calendarActivities,
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
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
    console.error('Error updating calendar:', error);
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
    console.error('Error deleting calendar:', error);
    return NextResponse.json({ error: 'Failed to delete calendar' }, { status: 500 });
  }
}
