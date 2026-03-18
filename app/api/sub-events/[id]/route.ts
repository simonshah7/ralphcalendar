import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    for (const field of ['title', 'type', 'startDatetime', 'endDatetime', 'location', 'description', 'sortOrder', 'calendarEventId']) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === 'string' ? (body[field].trim() || null) : body[field];
      }
    }
    const [updated] = await db.update(subEvents).set(updateData).where(eq(subEvents.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Sub-event not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating sub-event:', error);
    return NextResponse.json({ error: 'Failed to update sub-event' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(subEvents).where(eq(subEvents.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Sub-event not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-event:', error);
    return NextResponse.json({ error: 'Failed to delete sub-event' }, { status: 500 });
  }
}
