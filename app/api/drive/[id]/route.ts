import { NextResponse } from 'next/server';
import { readFile, getFileMetadata } from '@/lib/google-drive';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'content';

    if (mode === 'metadata') {
      const metadata = await getFileMetadata(id);
      return NextResponse.json(metadata);
    }

    const result = await readFile(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Drive file read error', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
