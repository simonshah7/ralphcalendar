import { NextResponse } from 'next/server';
import { db } from '@/db';
import { eventAttendees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    for (const field of ['name', 'email', 'company', 'attendeeType', 'role', 'hasPass', 'travelStatus', 'notes']) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string') {
          updateData[field] = body[field].trim() || null;
        } else {
          updateData[field] = body[field];
        }
      }
    }
    const [updated] = await db.update(eventAttendees).set(updateData).where(eq(eventAttendees.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating attendee', error);
    return NextResponse.json({ error: 'Failed to update attendee' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(eventAttendees).where(eq(eventAttendees.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting attendee', error);
    return NextResponse.json({ error: 'Failed to delete attendee' }, { status: 500 });
  }
}
