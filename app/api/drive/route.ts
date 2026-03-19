import { NextResponse } from 'next/server';
import { listFiles, getDriveFolderId } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let folderId = searchParams.get('folderId');
    const pageToken = searchParams.get('pageToken') || undefined;

    if (!folderId) {
      folderId = await getDriveFolderId();
    }

    const result = await listFiles(folderId, pageToken);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Drive list error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
