import { NextResponse } from 'next/server';
import { db, activities, statuses, swimlanes } from '@/db';
import { eq, InferSelectModel } from 'drizzle-orm';
import { isValidCurrency, isValidRegion, isValidUUID } from '@/lib/validation';

type Activity = InferSelectModel<typeof activities>;
type Status = InferSelectModel<typeof statuses>;
type Swimlane = InferSelectModel<typeof swimlanes>;

// Helper to convert empty strings to null (important for UUID fields)
function emptyToNull<T>(value: T): T | null {
  if (value === '' || value === undefined) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId || !isValidUUID(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId is required' }, { status: 400 });
    }

    const allActivities: Activity[] = await db
      .select()
      .from(activities)
      .where(eq(activities.calendarId, calendarId));

    return NextResponse.json(allActivities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
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
      targetSaos,
      actualSaos,
      pipelineGenerated,
      revenueGenerated,
      attachments,
    } = body;

    // Validation
    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }
    if (!swimlaneId) {
      return NextResponse.json({ error: 'swimlaneId is required' }, { status: 400 });
    }
    if (!statusId) {
      return NextResponse.json({ error: 'statusId is required' }, { status: 400 });
    }
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ error: 'Start date is required' }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ error: 'End date is required' }, { status: 400 });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return NextResponse.json({ error: 'End date must be after or equal to start date' }, { status: 400 });
    }
    if (currency && !isValidCurrency(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
    }
    if (region && !isValidRegion(region)) {
      return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
    }
    if (cost !== undefined && cost < 0) {
      return NextResponse.json({ error: 'Cost must be >= 0' }, { status: 400 });
    }

    // Verify swimlane exists
    const [swimlane]: Swimlane[] = await db.select().from(swimlanes).where(eq(swimlanes.id, swimlaneId));
    if (!swimlane) {
      return NextResponse.json({ error: 'Swimlane not found' }, { status: 400 });
    }

    // Verify status exists
    const [status]: Status[] = await db.select().from(statuses).where(eq(statuses.id, statusId));
    if (!status) {
      return NextResponse.json({ error: 'Status not found' }, { status: 400 });
    }

    // Use Drizzle ORM insert
    const campaignIdValue = (campaignId && typeof campaignId === 'string' && campaignId.trim()) ? campaignId.trim() : null;
    const descriptionValue = (description && typeof description === 'string' && description.trim()) ? description.trim() : null;
    const tagsValue = (tags && typeof tags === 'string' && tags.trim()) ? tags.trim() : null;
    const colorValue = (color && typeof color === 'string' && color.trim()) ? color.trim() : null;

    const [newActivity] = await db.insert(activities).values({
      calendarId,
      swimlaneId,
      statusId: statusId || null,
      campaignId: campaignIdValue,
      title: title.trim(),
      startDate,
      endDate,
      description: descriptionValue,
      cost: cost !== undefined ? String(cost) : '0',
      actualCost: actualCost !== undefined ? String(actualCost) : '0',
      currency: currency || 'USD',
      region: region || 'US',
      tags: tagsValue,
      color: colorValue,
      expectedSaos: expectedSaos !== undefined ? String(expectedSaos) : '0',
      targetSaos: targetSaos !== undefined ? String(targetSaos) : '0',
      actualSaos: actualSaos !== undefined ? String(actualSaos) : '0',
      pipelineGenerated: pipelineGenerated !== undefined ? String(pipelineGenerated) : '0',
      revenueGenerated: revenueGenerated !== undefined ? String(revenueGenerated) : '0',
      attachments: attachments || [],
    }).returning();

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
