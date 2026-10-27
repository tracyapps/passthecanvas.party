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
