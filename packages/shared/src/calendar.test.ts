import { describe, expect, it } from 'vitest';
import { addToCalendarLinks, calendarFile, subscribeLinks } from './calendar';

const party = { id: 'abc', title: 'Paint, night; fun', startsAt: '2026-11-20T01:00:00.000Z', durationMinutes: 90, description: 'Hosted by Ada', url: 'https://passthecanvas.party/?party=p-1' };

describe('calendars', () => {
  it('writes a safe calendar with a reminder', () => {
    const ics = calendarFile([party], { name: 'Parties', now: new Date('2026-11-01T00:00:00Z') });
    expect(ics).toContain('SUMMARY:Paint\\, night\\; fun');
    expect(ics).toContain('DTSTART:20261120T010000Z');
    expect(ics).toContain('DTEND:20261120T023000Z');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('X-WR-CALNAME:Parties');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
  it('makes add-to-calendar and subscribe links', () => {
    const google = addToCalendarLinks(party)[0]!.href;
    expect(new URL(google).searchParams.get('dates')).toBe('20261120T010000Z/20261120T023000Z');
    const subs = subscribeLinks('https://api.example/api/calendar/t.ics');
    expect(subs[0]!.href).toBe('webcal://api.example/api/calendar/t.ics');
    expect(new URL(subs[1]!.href).searchParams.get('cid')).toBe('webcal://api.example/api/calendar/t.ics');
  });
});
