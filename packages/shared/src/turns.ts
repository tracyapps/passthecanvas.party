import type { PartyTiming } from './community';

// Pure turn logic, no networking. Easy to test and shared by server + web.

/** Who paints in a given round? Rounds are 1-based and wrap around the order. */
export function painterForRound(order: string[], round: number): string | null {
  if (order.length === 0) return null;
  const index = (round - 1) % order.length;
  return order[index] ?? null;
}

/** How many turns until this member paints? 0 = painting now. */
export function turnsUntil(order: string[], round: number, memberId: string): number | null {
  const mine = order.indexOf(memberId);
  if (mine === -1 || order.length === 0) return null;
  const current = (round - 1) % order.length;
  return (mine - current + order.length) % order.length;
}

/** "1:05" style clock text for the timer. */
export function clockText(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ---------- lobby settings (host only) ----------

/** Turn lengths the host can pick from, in seconds. */
export const TURN_LENGTHS = [30, 60, 90, 120, 180, 300] as const;
export const MIN_TURN_SECONDS = 20;
export const MAX_TURN_SECONDS = 600;

/** "30 seconds", "1 minute", "1 min 30 sec": turn lengths in words for the lobby. */
export function turnLengthText(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} seconds`;
  if (seconds === 0) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  return `${minutes} min ${seconds} sec`;
}

/** A turn length from the network, clamped to a sane whole number of seconds. */
export function clampTurnSeconds(value: unknown): number | null {
  const seconds = Math.round(Number(value));
  if (!Number.isFinite(seconds)) return null;
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, seconds));
}

/**
 * A new passing order from the host. It must name exactly the people already
 * in the party, each once — anything else is refused (null).
 */
export function reorder(current: string[], proposed: unknown): string[] | null {
  if (!Array.isArray(proposed) || proposed.length !== current.length) return null;
  const ids = proposed.map(String);
  if (new Set(ids).size !== ids.length) return null;
  if (!ids.every((id) => current.includes(id))) return null;
  return ids;
}

/** Move one person earlier (-1) or later (+1) in the order. Used by the lobby buttons. */
export function moveInOrder(order: string[], id: string, step: -1 | 1): string[] {
  const from = order.indexOf(id);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

// ---------- party timing: a set party length, or a set turn length ----------


/** The short "pass the canvas" card between rounds, in seconds (server PASS_CARD_MS). */
export const PASS_SECONDS = 4;

export interface TimingPlan {
  rounds: number;
  turnSeconds: number;
  /** Rounds × turn + the passes between them. */
  paintingSeconds: number;
  /** Intro + painting + wrap-up. */
  totalSeconds: number;
  /** In 'party' mode: the turns couldn't fit, so they're at the shortest allowed. */
  tooShort: boolean;
}

const turnStep = (seconds: number) => Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, Math.floor(seconds / 5) * 5));

/**
 * How a party's time works out for this many artists (N + 1 rounds: everyone
 * paints every canvas, and the owner paints first and last).
 * - 'turn': each turn is fixed; the party is as long as it takes.
 * - 'party': the party length is fixed; turns share what's left after the
 *   intro, the wrap-up and the passing cards.
 */
export function planTiming(timing: PartyTiming, artists: number): TimingPlan {
  const rounds = Math.max(1, artists) + 1;
  const passes = (rounds - 1) * PASS_SECONDS;
  const extras = (timing.introMinutes + timing.wrapMinutes) * 60;
  let turnSeconds = timing.turnSeconds;
  let tooShort = false;
  if (timing.mode === 'party') {
    const available = timing.partyMinutes * 60 - extras - passes;
    const fair = available / rounds;
    tooShort = fair < MIN_TURN_SECONDS;
    turnSeconds = turnStep(fair);
  }
  const paintingSeconds = rounds * turnSeconds + passes;
  return { rounds, turnSeconds, paintingSeconds, totalSeconds: paintingSeconds + extras, tooShort };
}

/**
 * Mid-party, in 'party' mode: a fair turn length for the rounds still to
 * paint (including the one underway), given the time left until the party
 * is meant to end. The wrap-up is kept.
 */
export function turnSecondsForRest(timing: PartyTiming, roundsLeft: number, secondsUntilEnd: number): number {
  const left = Math.max(1, roundsLeft);
  const available = secondsUntilEnd - timing.wrapMinutes * 60 - (left - 1) * PASS_SECONDS;
  return turnStep(available / left);
}

/** "1 hr 5 min", "45 min": party lengths in words. */
export function durationText(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : h === 1 ? '1 hour' : `${h} hours`;
}
