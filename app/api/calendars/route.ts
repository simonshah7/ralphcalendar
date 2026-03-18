import { NextResponse } from 'next/server';
import { db, calendars, statuses, users } from '@/db';
import { eq } from 'drizzle-orm';
import { DEFAULT_STATUSES } from '@/lib/utils';

// Get or create a default user (until auth is added)
async function getDefaultUserId(): Promise<string> {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) {
    return existingUsers[0].id;
  }
  const [newUser] = await db
    .insert(users)
    .values({
      email: 'default@campaignos.local',
      name: 'Default User',
      passwordHash: 'no-auth',
    })
    .returning();
  return newUser.id;
}

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

    const ownerId = await getDefaultUserId();

    // Create calendar
    const [newCalendar] = await db
      .insert(calendars)
      .values({ name: name.trim(), ownerId })
      .returning();

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
