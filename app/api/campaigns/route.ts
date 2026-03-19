import { NextResponse } from 'next/server';
import { db, campaigns } from '@/db';
import { eq } from 'drizzle-orm';
import { isValidUUID } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');

    if (!calendarId || !isValidUUID(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId is required' }, { status: 400 });
    }

    const allCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.calendarId, calendarId));

    return NextResponse.json(allCampaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, name, budget } = body;

    if (!calendarId || !isValidUUID(calendarId)) {
      return NextResponse.json({ error: 'Valid calendarId is required' }, { status: 400 });
    }
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        calendarId,
        name: name.trim(),
        budget: budget !== undefined ? String(budget) : '0',
      })
      .returning();

    return NextResponse.json(newCampaign, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
