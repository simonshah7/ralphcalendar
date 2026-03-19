import { NextResponse } from 'next/server';
import { db, feedbackItems } from '@/db';
import { eq } from 'drizzle-orm';
import { ensureFeedbackTable } from '@/db/ensure-feedback-table';
import { logger } from '@/lib/logger';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureFeedbackTable(db);
    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.category !== undefined) updates.category = body.category;
    if (body.priority !== undefined) updates.priority = body.priority;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(feedbackItems)
      .set(updates)
      .where(eq(feedbackItems.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating feedback', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureFeedbackTable(db);
    const { id } = await params;
    const [deleted] = await db
      .delete(feedbackItems)
      .where(eq(feedbackItems.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Feedback item not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Error deleting feedback', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
