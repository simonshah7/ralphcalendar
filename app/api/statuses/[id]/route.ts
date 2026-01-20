import { NextResponse } from 'next/server';
import { db, statuses } from '@/db';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color, sortOrder } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = name.trim();
    }
    if (color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return NextResponse.json({ error: 'Valid hex color is required' }, { status: 400 });
      }
      updates.color = color;
    }
    if (sortOrder !== undefined) {
      updates.sortOrder = sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(statuses)
      .set(updates)
      .where(eq(statuses.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(statuses).where(eq(statuses.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting status:', error);
    return NextResponse.json({ error: 'Failed to delete status' }, { status: 500 });
  }
}
