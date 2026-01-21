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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const allActivities = await db
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
      currency,
      region,
      tags,
      color,
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
    const [swimlane] = await db.select().from(swimlanes).where(eq(swimlanes.id, swimlaneId));
    if (!swimlane) {
      return NextResponse.json({ error: 'Swimlane not found' }, { status: 400 });
    }

    // Verify status exists
    const [status] = await db.select().from(statuses).where(eq(statuses.id, statusId));
    if (!status) {
      return NextResponse.json({ error: 'Status not found' }, { status: 400 });
    }

    const [newActivity] = await db
      .insert(activities)
      .values({
        calendarId,
        swimlaneId,
        statusId,
        campaignId: emptyToNull(campaignId),
        title: title.trim(),
        startDate,
        endDate,
        description: emptyToNull(description),
        cost: cost?.toString() || '0',
        currency: currency || 'USD',
        region: region || 'US',
        tags: emptyToNull(tags),
        color: emptyToNull(color),
      })
      .returning();

    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create activity: ${errorMessage}` }, { status: 500 });
  }
}
