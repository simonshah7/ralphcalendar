/**
 * ICS (iCalendar) file generator - RFC 5545 compliant
 * Generates .ics content for calendar invites (Outlook, Google Calendar, Apple Calendar, etc.)
 */

interface ICSAttendee {
  name: string;
  email: string;
}

interface ICSEventOptions {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtStart: string; // ISO date string (YYYY-MM-DD or full ISO datetime)
  dtEnd: string;   // ISO date string (YYYY-MM-DD or full ISO datetime)
  organizerName?: string;
  organizerEmail?: string;
  attendees?: ICSAttendee[];
  method?: 'REQUEST' | 'CANCEL';
  sequence?: number;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatICSDate(isoString: string): string {
  // If it's a date-only string (YYYY-MM-DD), return VALUE=DATE format
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString.replace(/-/g, '');
  }
  // Otherwise parse as datetime and return UTC format
  const d = new Date(isoString);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function isDateOnly(isoString: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoString);
}

function nowICSTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function generateICS(options: ICSEventOptions): string {
  const {
    uid,
    summary,
    description,
    location,
    dtStart,
    dtEnd,
    organizerName,
    organizerEmail,
    attendees = [],
    method = 'REQUEST',
    sequence = 0,
  } = options;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LaunchGrid//Calendar Invite//EN',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowICSTimestamp()}`,
    `SEQUENCE:${sequence}`,
    `SUMMARY:${escapeICSText(summary)}`,
  ];

  // Date formatting: all-day vs datetime
  const startIsDate = isDateOnly(dtStart);
  const endIsDate = isDateOnly(dtEnd);

  if (startIsDate) {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(dtStart)}`);
  } else {
    lines.push(`DTSTART:${formatICSDate(dtStart)}`);
  }

  if (endIsDate) {
    // ICS all-day events use exclusive end date, so add 1 day
    const endDate = new Date(dtEnd);
    endDate.setDate(endDate.getDate() + 1);
    const y = endDate.getFullYear();
    const m = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const d = endDate.getDate().toString().padStart(2, '0');
    lines.push(`DTEND;VALUE=DATE:${y}${m}${d}`);
  } else {
    lines.push(`DTEND:${formatICSDate(dtEnd)}`);
  }

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeICSText(location)}`);
  }

  if (organizerEmail) {
    const cn = organizerName ? `;CN=${escapeICSText(organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${organizerEmail}`);
  }

  for (const attendee of attendees) {
    lines.push(`ATTENDEE;CN=${escapeICSText(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

interface EventData {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  description: string | null;
}

interface SubEventData {
  id: string;
  title: string;
  startDatetime: string | null;
  endDatetime: string | null;
  location: string | null;
  description: string | null;
}

interface OrganizerSettings {
  name?: string;
  email?: string;
}

export function generateICSForEvent(
  event: EventData,
  attendees: ICSAttendee[],
  organizer: OrganizerSettings,
  subEvents?: SubEventData[],
): string {
  const locationStr = [event.venue, event.location].filter(Boolean).join(', ');

  // If sub-events with datetimes exist, create a multi-event ICS
  const timedSubEvents = (subEvents || []).filter(se => se.startDatetime && se.endDatetime);

  if (timedSubEvents.length > 0) {
    // Build a single VCALENDAR with multiple VEVENTs
    const parts: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LaunchGrid//Calendar Invite//EN',
      'METHOD:REQUEST',
      'CALSCALE:GREGORIAN',
    ];

    // Main event as all-day wrapper
    if (event.startDate && event.endDate) {
      const mainLines = buildVEvent({
        uid: `${event.id}@launchgrid`,
        summary: event.title,
        description: event.description || undefined,
        location: locationStr || undefined,
        dtStart: event.startDate,
        dtEnd: event.endDate,
        organizerName: organizer.name,
        organizerEmail: organizer.email,
        attendees,
      });
      parts.push(...mainLines);
    }

    // Sub-events as individual timed events
    for (const se of timedSubEvents) {
      const seLocation = se.location || locationStr || undefined;
      const seLines = buildVEvent({
        uid: `${se.id}@launchgrid`,
        summary: `${event.title}: ${se.title}`,
        description: se.description || undefined,
        location: seLocation,
        dtStart: se.startDatetime!,
        dtEnd: se.endDatetime!,
        organizerName: organizer.name,
        organizerEmail: organizer.email,
        attendees,
      });
      parts.push(...seLines);
    }

    parts.push('END:VCALENDAR');
    return parts.join('\r\n');
  }

  // Simple case: single event ICS
  return generateICS({
    uid: `${event.id}@launchgrid`,
    summary: event.title,
    description: event.description || undefined,
    location: locationStr || undefined,
    dtStart: event.startDate || new Date().toISOString().split('T')[0],
    dtEnd: event.endDate || event.startDate || new Date().toISOString().split('T')[0],
    organizerName: organizer.name,
    organizerEmail: organizer.email,
    attendees,
    method: 'REQUEST',
  });
}

// Helper: build VEVENT lines without the VCALENDAR wrapper
function buildVEvent(options: ICSEventOptions): string[] {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${options.uid}`,
    `DTSTAMP:${nowICSTimestamp()}`,
    `SEQUENCE:${options.sequence || 0}`,
    `SUMMARY:${escapeICSText(options.summary)}`,
  ];

  const startIsDate = isDateOnly(options.dtStart);
  const endIsDate = isDateOnly(options.dtEnd);

  if (startIsDate) {
    lines.push(`DTSTART;VALUE=DATE:${formatICSDate(options.dtStart)}`);
  } else {
    lines.push(`DTSTART:${formatICSDate(options.dtStart)}`);
  }

  if (endIsDate) {
    const endDate = new Date(options.dtEnd);
    endDate.setDate(endDate.getDate() + 1);
    const y = endDate.getFullYear();
    const m = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const d = endDate.getDate().toString().padStart(2, '0');
    lines.push(`DTEND;VALUE=DATE:${y}${m}${d}`);
  } else {
    lines.push(`DTEND:${formatICSDate(options.dtEnd)}`);
  }

  if (options.description) {
    lines.push(`DESCRIPTION:${escapeICSText(options.description)}`);
  }

  if (options.location) {
    lines.push(`LOCATION:${escapeICSText(options.location)}`);
  }

  if (options.organizerEmail) {
    const cn = options.organizerName ? `;CN=${escapeICSText(options.organizerName)}` : '';
    lines.push(`ORGANIZER${cn}:mailto:${options.organizerEmail}`);
  }

  for (const attendee of (options.attendees || [])) {
    lines.push(`ATTENDEE;CN=${escapeICSText(attendee.name)};RSVP=TRUE:mailto:${attendee.email}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');

  return lines;
}
