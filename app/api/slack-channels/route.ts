import { NextResponse } from 'next/server';
import { db } from '@/db';
import { adminSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cursor = searchParams.get('cursor') || undefined;

    // Get Slack Bot Token from admin settings
    const settings = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, 'slack_bot_token'));
    const botToken = settings[0]?.value;

    if (!botToken) {
      return NextResponse.json(
        { error: 'Slack Bot Token not configured. Set it in Settings.' },
        { status: 400 }
      );
    }

    // Fetch channels from Slack API
    const params = new URLSearchParams({
      types: 'public_channel,private_channel',
      exclude_archived: 'true',
      limit: '200',
    });
    if (cursor) {
      params.set('cursor', cursor);
    }

    const slackRes = await fetch(
      `https://slack.com/api/conversations.list?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const slackData = await slackRes.json();

    if (!slackData.ok) {
      return NextResponse.json(
        { error: `Slack API error: ${slackData.error}` },
        { status: 502 }
      );
    }

    // Map and filter channels
    let channels = (slackData.channels || []).map(
      (ch: { id: string; name: string; is_private: boolean; num_members: number }) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        num_members: ch.num_members,
      })
    );

    // Filter by search term if provided
    if (search) {
      const term = search.toLowerCase();
      channels = channels.filter(
        (ch: { name: string }) => ch.name.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({
      channels,
      next_cursor: slackData.response_metadata?.next_cursor || null,
    });
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Slack channels' },
      { status: 500 }
    );
  }
}
