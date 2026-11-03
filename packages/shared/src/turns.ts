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
