import { NextResponse } from 'next/server';
import { db } from '@/db';
import { checklistItems } from '@/db/schema';
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
    for (const field of ['title', 'isDone', 'category', 'dueDate', 'sortOrder']) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string') {
          updateData[field] = body[field].trim() || null;
        } else {
          updateData[field] = body[field];
        }
      }
    }
    const [updated] = await db.update(checklistItems).set(updateData).where(eq(checklistItems.id, id)).returning();
    if (!updated) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating checklist item', error);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(checklistItems).where(eq(checklistItems.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting checklist item', error);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}
