import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, checklistItems, eventAttendees, adminSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ChecklistItem, EventAttendee } from '@/db/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, type } = body;

    const [event] = await db.select().from(events).where(eq(events.id, id));
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get webhook URL: prefer event-level, fall back to admin global setting
    let webhookUrl = event.slackWebhookUrl;
    if (!webhookUrl) {
      const settings = await db.select().from(adminSettings).where(eq(adminSettings.key, 'slack_webhook_url'));
      webhookUrl = settings[0]?.value || null;
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: 'No Slack webhook URL configured. Set it in Admin Settings or on the event.' }, { status: 400 });
    }

    // Build message based on type
    let slackMessage: { text: string; blocks?: unknown[] };

    if (type === 'status_update') {
      const checklist = await db.select().from(checklistItems).where(eq(checklistItems.eventId, id));
      const done = checklist.filter((c: ChecklistItem) => c.isDone).length;
      const total = checklist.length;
      const attendees = await db.select().from(eventAttendees).where(eq(eventAttendees.eventId, id));

      slackMessage = {
        text: `Event Update: ${event.title}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `${event.title} - Status Update` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Dates:*\n${event.startDate} to ${event.endDate}` },
              { type: 'mrkdwn', text: `*Location:*\n${event.location || 'TBD'}` },
              { type: 'mrkdwn', text: `*Checklist:*\n${done}/${total} complete` },
              { type: 'mrkdwn', text: `*Attendees:*\n${attendees.length} confirmed` },
              { type: 'mrkdwn', text: `*Passes:*\n${attendees.filter((a: EventAttendee) => a.hasPass).length}/${event.totalPasses} allocated` },
            ],
          },
        ],
      };
    } else if (type === 'custom' && message) {
      slackMessage = {
        text: `${event.title}: ${message}`,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${event.title}*\n${message}` },
          },
        ],
      };
    } else {
      slackMessage = {
        text: message || `Update from CampaignOS: ${event.title}`,
      };
    }

    // Send to Slack
    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      return NextResponse.json(
        { error: `Slack webhook failed: ${errorText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Slack notification sent' });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return NextResponse.json({ error: 'Failed to send Slack notification' }, { status: 500 });
  }
}
