import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignReportData } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get('calendarId');
  const source = searchParams.get('source');

  if (!calendarId) {
    return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
  }

  try {
    const conditions = [eq(campaignReportData.calendarId, calendarId)];
    if (source) {
      conditions.push(eq(campaignReportData.source, source as any));
    }

    const rows = await db
      .select()
      .from(campaignReportData)
      .where(and(...conditions));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch campaign report data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
