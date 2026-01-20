import { NextResponse } from 'next/server';
import { db, statuses } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allStatuses = await db
      .select()
      .from(statuses)
      .where(eq(statuses.calendarId, calendarId));

    return NextResponse.json(allStatuses);
  } catch (error) {
    console.error('Error fetching statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch statuses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, name, color, sortOrder } = body;

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Valid hex color is required' }, { status: 400 });
    }

    const [newStatus] = await db
      .insert(statuses)
      .values({
        calendarId,
        name: name.trim(),
        color,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json(newStatus, { status: 201 });
  } catch (error) {
    console.error('Error creating status:', error);
    return NextResponse.json({ error: 'Failed to create status' }, { status: 500 });
  }
}
