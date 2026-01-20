import { NextResponse } from 'next/server';
import { db, activities } from '@/db';
import { eq } from 'drizzle-orm';
import { CURRENCIES, REGIONS } from '@/lib/utils';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      swimlaneId,
      statusId,
      campaignId,
      title,
      startDate,
      endDate,
      description,
      cost,
      currency,
      region,
      tags,
      color,
    } = body;

    const updates: Record<string, unknown> = {};

    if (swimlaneId !== undefined) updates.swimlaneId = swimlaneId;
    if (statusId !== undefined) updates.statusId = statusId;
    if (campaignId !== undefined) updates.campaignId = campaignId || null;

    if (title !== undefined) {
      if (title.trim().length === 0) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    // Validate date range if both are being updated or one is being updated
    const finalStartDate = startDate || undefined;
    const finalEndDate = endDate || undefined;
    if (finalStartDate && finalEndDate && new Date(finalEndDate) < new Date(finalStartDate)) {
      return NextResponse.json({ error: 'End date must be after or equal to start date' }, { status: 400 });
    }

    if (description !== undefined) updates.description = description || null;

    if (cost !== undefined) {
      if (cost < 0) {
        return NextResponse.json({ error: 'Cost must be >= 0' }, { status: 400 });
      }
      updates.cost = cost.toString();
    }

    if (currency !== undefined) {
      if (!CURRENCIES.includes(currency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }
      updates.currency = currency;
    }

    if (region !== undefined) {
      if (!REGIONS.includes(region)) {
        return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
      }
      updates.region = region;
    }

    if (tags !== undefined) updates.tags = tags || null;
    if (color !== undefined) updates.color = color || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(activities)
      .set(updates)
      .where(eq(activities.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating activity:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(activities).where(eq(activities.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
  }
}
