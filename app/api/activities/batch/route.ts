import { NextResponse } from 'next/server';
import { db, activities, statuses, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';
import { isValidCurrency, isValidRegion } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, items } = body;

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items must be a non-empty array' }, { status: 400 });
    }

    // Pre-validate all items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.title || !item.title.trim()) {
        return NextResponse.json({ error: `Item ${i}: title is required` }, { status: 400 });
      }
      if (!item.startDate || !item.endDate) {
        return NextResponse.json({ error: `Item ${i}: dates are required` }, { status: 400 });
      }
      if (new Date(item.endDate) < new Date(item.startDate)) {
        return NextResponse.json({ error: `Item ${i}: end date must be >= start date` }, { status: 400 });
      }
      if (!item.swimlaneId || !item.statusId) {
        return NextResponse.json({ error: `Item ${i}: swimlaneId and statusId are required` }, { status: 400 });
      }
      if (item.currency && !isValidCurrency(item.currency)) {
        return NextResponse.json({ error: `Item ${i}: invalid currency` }, { status: 400 });
      }
      if (item.region && !isValidRegion(item.region)) {
        return NextResponse.json({ error: `Item ${i}: invalid region` }, { status: 400 });
      }
    }

    const created = [];
    for (const item of items) {
      const [newActivity] = await db.insert(activities).values({
        calendarId,
        swimlaneId: item.swimlaneId,
        statusId: item.statusId,
        campaignId: item.campaignId || null,
        title: item.title.trim(),
        startDate: item.startDate,
        endDate: item.endDate,
        description: item.description || null,
        cost: item.cost !== undefined ? String(item.cost) : '0',
        actualCost: item.actualCost !== undefined ? String(item.actualCost) : '0',
        currency: item.currency || 'USD',
        region: item.region || 'US',
        tags: item.tags || null,
        color: item.color || null,
        expectedSaos: item.expectedSaos !== undefined ? String(item.expectedSaos) : '0',
        targetSaos: item.targetSaos !== undefined ? String(item.targetSaos) : '0',
        actualSaos: item.actualSaos !== undefined ? String(item.actualSaos) : '0',
        pipelineGenerated: item.pipelineGenerated !== undefined ? String(item.pipelineGenerated) : '0',
        revenueGenerated: item.revenueGenerated !== undefined ? String(item.revenueGenerated) : '0',
        attachments: item.attachments || [],
      }).returning();
      created.push(newActivity);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error batch creating activities', error);
    return NextResponse.json(
      { error: 'Failed to batch create activities' },
      { status: 500 }
    );
  }
}
