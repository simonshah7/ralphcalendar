import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventAttendees } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    const items = await db.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching attendees:', error);
    return NextResponse.json({ error: 'Failed to fetch attendees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, name, email, company, attendeeType, role, hasPass, travelStatus, notes } = body;

    if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!attendeeType || !['internal', 'customer'].includes(attendeeType)) {
      return NextResponse.json({ error: 'attendeeType must be "internal" or "customer"' }, { status: 400 });
    }

    const [created] = await db.insert(eventAttendees).values({
      eventId,
      name: name.trim(),
      email: email?.trim() || null,
      company: company?.trim() || null,
      attendeeType,
      role: role?.trim() || null,
      hasPass: hasPass ?? false,
      travelStatus: travelStatus || 'not_booked',
      notes: notes?.trim() || null,
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating attendee:', error);
    return NextResponse.json({ error: 'Failed to create attendee' }, { status: 500 });
  }
}
