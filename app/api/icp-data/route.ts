import { NextResponse } from 'next/server';
import { parseICPSpreadsheet } from '@/lib/icp-parser';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const { summary, topAccounts } = parseICPSpreadsheet();
    return NextResponse.json({ summary, topAccounts });
  } catch (error) {
    logger.error('Failed to parse ICP spreadsheet', error);
    return NextResponse.json({ error: 'Failed to parse ICP data' }, { status: 500 });
  }
}
