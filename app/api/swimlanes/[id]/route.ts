import { NextResponse } from 'next/server';
import { db, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, sortOrder } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (sortOrder !== undefined) {
      updates.sortOrder = sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(swimlanes)
      .set(updates)
      .where(eq(swimlanes.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Swimlane not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating swimlane:', error);
    return NextResponse.json({ error: 'Failed to update swimlane' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(swimlanes).where(eq(swimlanes.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Swimlane not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting swimlane:', error);
    return NextResponse.json({ error: 'Failed to delete swimlane' }, { status: 500 });
  }
}
