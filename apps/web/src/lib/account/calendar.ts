import type { ScheduledParty } from '@ptc/shared';
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
// Escape calendar text so a party title cannot inject new calendar properties.
const escape = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '').replaceAll(',', '\\,').replaceAll(';', '\\;');
export function partyCalendar(party: ScheduledParty, now = new Date()): string {
  const start = new Date(party.startsAt);
  const end = new Date(start.getTime() + party.durationMinutes * 60_000);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pass the Canvas//Studio Calendar//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${party.id}@passthecanvas.party`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escape(party.title)}`, `DESCRIPTION:${escape(`Art party hosted by ${party.hostName}. Scheduled time zone: ${party.timeZone}. Open Your Studio for the latest invitation status. The multiplayer party is still in development.`)}`, 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Your art party starts in 15 minutes', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  // RFC 5545 uses CRLF and folds at 75 octets, including multibyte names.
  const encoder = new TextEncoder();
  return lines.map(line => {
    let folded = ''; let bytes = 0;
    for (const character of line) {
      const size = encoder.encode(character).length;
      if (bytes + size > 75) { folded += '\r\n '; bytes = 1; }
      folded += character; bytes += size;
    }
    return folded;
  }).join('\r\n') + '\r\n';
}
