import { NextResponse } from 'next/server';
import { db, swimlanes } from '@/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { order } = body;

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { error: 'order must be a non-empty array of { id, sortOrder }' },
        { status: 400 }
      );
    }

    for (const item of order) {
      if (!item.id || item.sortOrder === undefined) {
        return NextResponse.json(
          { error: 'Each item must have id and sortOrder' },
          { status: 400 }
        );
      }
    }

    await Promise.all(
      order.map((item: { id: string; sortOrder: number }) =>
        db
          .update(swimlanes)
          .set({ sortOrder: String(item.sortOrder) })
          .where(eq(swimlanes.id, item.id))
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error reordering swimlanes', error);
    return NextResponse.json(
      { error: 'Failed to reorder swimlanes' },
      { status: 500 }
    );
  }
}
