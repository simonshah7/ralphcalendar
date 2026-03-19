import { NextResponse } from 'next/server';
import { db } from '@/db';
import { checklistItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    const items = await db.select().from(checklistItems).where(eq(checklistItems.eventId, eventId));
    return NextResponse.json(items);
  } catch (error) {
    logger.error('Error fetching checklist items', error);
    return NextResponse.json({ error: 'Failed to fetch checklist items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventId, title, category, dueDate, sortOrder } = body;

    if (!eventId) return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const [created] = await db.insert(checklistItems).values({
      eventId,
      title: title.trim(),
      isDone: false,
      category: category?.trim() || null,
      dueDate: dueDate || null,
      sortOrder: sortOrder ?? 0,
    }).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating checklist item', error);
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
  }
}
