// Small helpers for showing scheduled parties.
import { addToCalendarLinks, durationText, planTiming, turnLengthText, type CalendarEvent, type ScheduledParty } from '@ptc/shared';
import { partyCalendar } from '../calendar';
import { fileSlug, saveFile } from '../../download';

export type PartyStatus = 'hosting' | 'going' | 'invited' | 'declined' | 'cancelled';

/** Started and not over yet. */
export const isLive = (party: ScheduledParty) => {
  const start = new Date(party.startsAt).getTime();
  return !party.cancelled && start <= Date.now() && Date.now() < start + party.durationMinutes * 60_000;
};

export function statusOf(party: ScheduledParty): PartyStatus {
  if (party.cancelled) return 'cancelled';
  if (party.hosting) return 'hosting';
  return party.response === 'yes' ? 'going' : party.response === 'no' ? 'declined' : 'invited';
}

export const STATUS_TEXT: Record<PartyStatus, string> = {
  hosting: "You're hosting",
  going: "You're going",
  invited: 'Invited: reply needed',
  declined: 'Not going',
  cancelled: 'Cancelled'
};

export const isPast = (party: ScheduledParty) => new Date(party.startsAt).getTime() + party.durationMinutes * 60_000 < Date.now();

export function roomLink(party: ScheduledParty): string {
  return `${location.origin}/?party=${party.roomId}`;
}

export function eventOf(party: ScheduledParty): CalendarEvent {
  return { id: party.id, title: party.title, startsAt: party.startsAt, durationMinutes: party.durationMinutes, description: `Art party hosted by ${party.hostName}. ${party.settings.description}`.trim(), url: roomLink(party), cancelled: party.cancelled };
}

export function calendarLinks(party: ScheduledParty) {
  return addToCalendarLinks(eventOf(party));
}

export function downloadIcs(party: ScheduledParty) {
  // The share sheet on iPad/iPhone (it offers Calendar); a normal download elsewhere.
  void saveFile(new Blob([partyCalendar(party)], { type: 'text/calendar;charset=utf-8' }), `${fileSlug(party.title, 'party')}.ics`, party.title);
}

/** "Turns of 4 min · about 1 hr 5 min for 6 artists" (or the set party length). */
export function timingSummary(party: ScheduledParty, artists = party.settings.maxGuests): string {
  const t = party.settings.timing;
  const plan = planTiming(t, Math.max(2, Math.min(artists, party.settings.maxGuests)));
  const turn = `${turnLengthText(plan.turnSeconds)} turns`;
  return t.mode === 'party' ? `${durationText(t.partyMinutes * 60)} party · about ${turn} with ${artists} artists` : `${turn} · about ${durationText(plan.totalSeconds)} with ${artists} artists`;
}
