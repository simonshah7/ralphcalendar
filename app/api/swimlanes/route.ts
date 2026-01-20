import { NextResponse } from 'next/server';
import { db, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allSwimlanes = await db
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.calendarId, calendarId));

    return NextResponse.json(allSwimlanes);
  } catch (error) {
    console.error('Error fetching swimlanes:', error);
    return NextResponse.json({ error: 'Failed to fetch swimlanes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, name, sortOrder } = body;

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [newSwimlane] = await db
      .insert(swimlanes)
      .values({
        calendarId,
        name: name.trim(),
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return NextResponse.json(newSwimlane, { status: 201 });
  } catch (error) {
    console.error('Error creating swimlane:', error);
    return NextResponse.json({ error: 'Failed to create swimlane' }, { status: 500 });
  }
}
