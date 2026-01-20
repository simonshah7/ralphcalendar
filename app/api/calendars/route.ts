import { NextResponse } from 'next/server';
import { db, calendars, statuses } from '@/db';
import { DEFAULT_STATUSES } from '@/lib/utils';

export async function GET() {
  try {
    const allCalendars = await db.select().from(calendars);
    return NextResponse.json(allCalendars);
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Create calendar
    const [newCalendar] = await db.insert(calendars).values({ name: name.trim() }).returning();

    // Create default statuses
    const statusValues = DEFAULT_STATUSES.map((status, index) => ({
      calendarId: newCalendar.id,
      name: status.name,
      color: status.color,
      sortOrder: index,
    }));

    const newStatuses = await db.insert(statuses).values(statusValues).returning();

    return NextResponse.json({ ...newCalendar, statuses: newStatuses }, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar:', error);
    return NextResponse.json({ error: 'Failed to create calendar' }, { status: 500 });
  }
}
