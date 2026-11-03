// Calendar files and "add to calendar" links for scheduled parties.
// One .ics writer for both the single-party download and the subscribable
// feed (served by the account server), so they always agree.

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string; // ISO
  durationMinutes: number;
  description: string;
  url?: string;
  cancelled?: boolean;
}

const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
// Escape calendar text so a party title cannot inject new calendar properties.
const escape = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '').replaceAll(',', '\\,').replaceAll(';', '\\;');

function fold(line: string): string {
  // RFC 5545 uses CRLF and folds at 75 octets, including multibyte names.
  const encoder = new TextEncoder();
  let folded = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      folded += '\r\n ';
      bytes = 1;
    }
    folded += character;
    bytes += size;
  }
  return folded;
}

/** A whole calendar: one event per party, each with a 15-minute reminder. */
export function calendarFile(events: CalendarEvent[], options: { name?: string; now?: Date } = {}): string {
  const now = options.now ?? new Date();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pass the Canvas//Studio Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (options.name) lines.push(`X-WR-CALNAME:${escape(options.name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H');
  for (const event of events) {
    const start = new Date(event.startsAt);
    const end = new Date(start.getTime() + event.durationMinutes * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@passthecanvas.party`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(event.description)}`,
      ...(event.url ? [`URL:${escape(event.url)}`] : []),
      `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Your art party starts in 15 minutes',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

const compact = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** One-click "add to calendar" links for the big web calendars. Apple and others use the .ics file. */
export function addToCalendarLinks(event: CalendarEvent): { label: string; href: string }[] {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const details = event.url ? `${event.description}\n\n${event.url}` : event.description;
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString();
  const outlook = (host: string) => `https://${host}/calendar/0/deeplink/compose?${q({ path: '/calendar/action/compose', rru: 'addevent', subject: event.title, body: details, startdt: start.toISOString(), enddt: end.toISOString() })}`;
  return [
    { label: 'Google Calendar', href: `https://calendar.google.com/calendar/render?${q({ action: 'TEMPLATE', text: event.title, dates: `${compact(start)}/${compact(end)}`, details })}` },
    { label: 'Outlook.com', href: outlook('outlook.live.com') },
    { label: 'Outlook (work or school)', href: outlook('outlook.office.com') },
    { label: 'Yahoo Calendar', href: `https://calendar.yahoo.com/?${q({ v: '60', title: event.title, st: compact(start), et: compact(end), desc: details })}` }
  ];
}

/** Ways to subscribe to a feed URL (https://…/api/calendar/<token>.ics). */
export function subscribeLinks(feedUrl: string, name = 'Pass the Canvas parties'): { label: string; href: string }[] {
  const webcal = feedUrl.replace(/^https?:/, 'webcal:');
  return [
    { label: 'Apple Calendar', href: webcal },
    { label: 'Google Calendar', href: `https://calendar.google.com/calendar/r?${new URLSearchParams({ cid: webcal })}` },
    { label: 'Outlook.com', href: `https://outlook.live.com/calendar/0/addfromweb?${new URLSearchParams({ url: feedUrl, name })}` },
    { label: 'Outlook (work or school)', href: `https://outlook.office.com/calendar/0/addfromweb?${new URLSearchParams({ url: feedUrl, name })}` }
  ];
}
