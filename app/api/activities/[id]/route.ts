import { NextResponse } from 'next/server';
import { db, activities, statuses, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';
import { CURRENCIES, REGIONS } from '@/lib/utils';

type Activity = InferSelectModel<typeof activities>;
type Status = InferSelectModel<typeof statuses>;
type Swimlane = InferSelectModel<typeof swimlanes>;

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
      actualCost,
      currency,
      region,
      tags,
      color,
      expectedSaos,
      actualSaos,
      pipelineGenerated,
      revenueGenerated,
      attachments,
    } = body;

    const updates: Record<string, unknown> = {};

    if (swimlaneId !== undefined) {
      // Verify swimlane exists
      const [swimlane]: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.id, swimlaneId));
      if (!swimlane) {
        return NextResponse.json({ error: 'Swimlane not found' }, { status: 400 });
      }
      updates.swimlaneId = swimlaneId;
    }
    if (statusId !== undefined) {
      // Verify status exists
      const [status]: Status[] = await db.select().from(statuses).where(eq(statuses.id, statusId));
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

    // Validate date range - fetch current activity to compare against when only one date changes
    if (startDate !== undefined || endDate !== undefined) {
      const [currentActivity]: Activity[] = await db.select().from(activities).where(eq(activities.id, id));
      if (currentActivity) {
        const finalStartDate = startDate ?? currentActivity.startDate;
        const finalEndDate = endDate ?? currentActivity.endDate;
        if (new Date(finalEndDate) < new Date(finalStartDate)) {
          return NextResponse.json({ error: 'End date must be after or equal to start date' }, { status: 400 });
        }
      }
    }

    if (description !== undefined) updates.description = emptyToNull(description);

    if (cost !== undefined) {
      if (cost < 0) {
        return NextResponse.json({ error: 'Cost must be >= 0' }, { status: 400 });
      }
      updates.cost = Number(cost);
    }

    if (currency !== undefined) {
      if (currency && !isValidCurrency(currency)) {
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }
      updates.currency = currency || 'US$';
    }

    if (region !== undefined) {
      if (region && !isValidRegion(region)) {
        return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
      }
      updates.region = region || 'US';
    }

    if (tags !== undefined) updates.tags = emptyToNull(tags);
    if (color !== undefined) updates.color = emptyToNull(color);

    if (actualCost !== undefined) {
      if (actualCost < 0) {
        return NextResponse.json({ error: 'Actual cost must be >= 0' }, { status: 400 });
      }
      updates.actualCost = Number(actualCost);
    }
    if (expectedSaos !== undefined) updates.expectedSaos = String(expectedSaos);
    if (actualSaos !== undefined) updates.actualSaos = String(actualSaos);
    if (pipelineGenerated !== undefined) updates.pipelineGenerated = String(pipelineGenerated);
    if (revenueGenerated !== undefined) updates.revenueGenerated = String(revenueGenerated);
    if (attachments !== undefined) updates.attachments = attachments;

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
