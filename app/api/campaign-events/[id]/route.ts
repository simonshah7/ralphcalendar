import { NextResponse } from 'next/server';
import { db } from '@/db';
import { campaignEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db.delete(campaignEvents).where(eq(campaignEvents.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting campaign-event link', error);
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
  }
}
