import { NextResponse } from 'next/server';
import { db, activities, statuses, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';
import { CURRENCIES, REGIONS } from '@/lib/utils';

// Type-safe includes check for readonly arrays
function isValidCurrency(value: string): boolean {
  return (CURRENCIES as readonly string[]).includes(value);
}

function isValidRegion(value: string): boolean {
  return (REGIONS as readonly string[]).includes(value);
}

// Helper to convert empty strings to null (important for UUID fields)
function emptyToNull<T>(value: T): T | null {
  if (value === '' || value === undefined) return null;
  return value;
}

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

    if (swimlaneId !== undefined) {
      // Verify swimlane exists
      const [swimlane] = await db.select().from(swimlanes).where(eq(swimlanes.id, swimlaneId));
      if (!swimlane) {
        return NextResponse.json({ error: 'Swimlane not found' }, { status: 400 });
      }
      updates.swimlaneId = swimlaneId;
    }
    if (statusId !== undefined) {
      // Verify status exists
      const [status] = await db.select().from(statuses).where(eq(statuses.id, statusId));
      if (!status) {
        return NextResponse.json({ error: 'Status not found' }, { status: 400 });
      }
      updates.statusId = statusId;
    }
    if (campaignId !== undefined) updates.campaignId = emptyToNull(campaignId);

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

    if (description !== undefined) updates.description = emptyToNull(description);

    if (cost !== undefined) {
      if (cost < 0) {
        return NextResponse.json({ error: 'Cost must be >= 0' }, { status: 400 });
      }
      updates.cost = cost.toString();
    }

    if (currency !== undefined) {
      if (currency && !isValidCurrency(currency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }
      updates.currency = currency || 'USD';
    }

    if (region !== undefined) {
      if (region && !isValidRegion(region)) {
        return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
      }
      updates.region = region || 'US';
    }

    if (tags !== undefined) updates.tags = emptyToNull(tags);
    if (color !== undefined) updates.color = emptyToNull(color);

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to update activity: ${errorMessage}` }, { status: 500 });
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
