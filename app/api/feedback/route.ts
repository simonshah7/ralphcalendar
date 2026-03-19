import { NextResponse } from 'next/server';
import { db, feedbackItems } from '@/db';
import { eq, desc, and, SQL } from 'drizzle-orm';
import { ensureFeedbackTable } from '@/db/ensure-feedback-table';

export async function GET(request: Request) {
  try {
    await ensureFeedbackTable(db);
    const { searchParams } = new URL(request.url);
    const screen = searchParams.get('screen');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    const conditions: SQL[] = [];
    if (screen) {
      conditions.push(eq(feedbackItems.screenName, screen));
    }
    if (category) {
      conditions.push(eq(feedbackItems.category, category as 'bug' | 'suggestion' | 'question' | 'general'));
    }
    if (status) {
      conditions.push(eq(feedbackItems.status, status as 'new' | 'in_progress' | 'resolved' | 'dismissed'));
    }

    const items = await db
      .select()
      .from(feedbackItems)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(feedbackItems.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { screenName, content, category, priority, testerName, browserInfo, url, metadata } = body;

    await ensureFeedbackTable(db);

    if (!screenName) {
      return NextResponse.json({ error: 'screenName is required' }, { status: 400 });
    }
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const [item] = await db.insert(feedbackItems).values({
      screenName,
      content: content.trim(),
      category: category || 'general',
      priority: priority || 'medium',
      testerName: testerName || null,
      browserInfo: browserInfo || null,
      url: url || null,
      metadata: metadata || null,
    }).returning();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create feedback: ${errorMessage}` }, { status: 500 });
  }
}
