import { calendarFile, type ScheduledParty } from '@ptc/shared';

/** One party as a downloadable .ics (Apple Calendar and everything else). */
export function partyCalendar(party: ScheduledParty, now = new Date(), origin = globalThis.location?.origin ?? 'https://passthecanvas.party'): string {
  return calendarFile([{ id: party.id, title: party.title, startsAt: party.startsAt, durationMinutes: party.durationMinutes, description: `Art party hosted by ${party.hostName}. ${party.settings?.description ?? ''}`.trim(), url: `${origin}/?party=${party.roomId}`, cancelled: party.cancelled }], { now });
}
