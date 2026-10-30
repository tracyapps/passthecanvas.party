import { describe,expect,it } from 'vitest';
import { partyCalendar } from './calendar';
describe('party calendar download',()=>{
  it('preserves absolute time across time zones, folds UTF-8 and escapes injected properties',()=>{
    const value=partyCalendar({id:'one',title:'Paint, together;\nATTENDEE:intruder',startsAt:'2026-11-01T07:30:00Z',timeZone:'America/Chicago',durationMinutes:60,hostName:'A very enthusiastic '+ 'é'.repeat(70),hosting:true,response:'yes',cancelled:false},new Date('2026-10-30T12:00:00Z'));
    expect(value).toContain('DTSTART:20261101T073000Z\r\n');
    expect(value).toContain('DTEND:20261101T083000Z\r\n');
    expect(value).not.toContain('\r\nATTENDEE:');
    expect(value).toContain('TRIGGER:-PT15M');
    expect(value.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75)).toBe(true);
    expect(value).toContain('Paint\\, together\\;\\nATTENDEE:intruder');
  });
});
