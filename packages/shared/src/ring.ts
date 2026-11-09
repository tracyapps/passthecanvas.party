// The passing ring. Everyone starts their own canvas; every round, each
// canvas moves one seat clockwise (to the painter's left) around the room.
//
// Because the ring is fixed for the whole game, each canvas visits every
// artist exactly once and then comes home: with N artists there are N + 1
// rounds, and the owner paints the first and the last layer.
//
// "Random" means: shuffle the seats into a random ring ONCE, then pass the
// same way every round. Reshuffling every round would break the promise
// that everyone paints on every canvas.

export type OrderMode = 'seats' | 'random' | 'custom';
export const ORDER_MODES: OrderMode[] = ['seats', 'random', 'custom'];

/**
 * Clockwise around the room by seat angle (yaw grows to the right, so
 * sorting by yaw goes clockwise seen from above). People who haven't picked a
 * seat follow, in the order they arrived.
 */
export function seatRing(memberIds: string[], seatOf: (id: string) => string | null, yawOf: Record<string, number>): string[] {
  const seated = memberIds.filter((id) => {
    const seat = seatOf(id);
    return seat !== null && Number.isFinite(yawOf[seat]);
  });
  seated.sort((a, b) => yawOf[seatOf(a)!]! - yawOf[seatOf(b)!]!);
  const standing = memberIds.filter((id) => !seated.includes(id));
  return [...seated, ...standing];
}

/** A random ring (Fisher–Yates). `random` is injectable for tests. */
export function shuffledRing(memberIds: string[], random: () => number = Math.random): string[] {
  const ring = [...memberIds];
  for (let i = ring.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ring[i], ring[j]] = [ring[j]!, ring[i]!];
  }
  return ring;
}

/**
 * N artists → N + 1 rounds (the owner bookends their own canvas). Going
 * around the circle more than once (`laps`): laps × N + 1, still ending with
 * the owner. Alone: one round per lap.
 */
export function roundsFor(artists: number, laps = 1): number {
  const times = Math.max(1, Math.floor(laps));
  return artists <= 1 ? Math.max(0, artists) * times : artists * times + 1;
}

/** Whose canvas does this artist paint in this round? (round is 1-based) */
export function canvasOwnerFor(ring: string[], painterId: string, round: number): string | null {
  const n = ring.length;
  const i = ring.indexOf(painterId);
  if (i === -1 || n === 0) return null;
  return ring[(((i - (round - 1)) % n) + n) % n] ?? null;
}

/** Who paints this owner's canvas in this round? */
export function painterOf(ring: string[], ownerId: string, round: number): string | null {
  const n = ring.length;
  const j = ring.indexOf(ownerId);
  if (j === -1 || n === 0) return null;
  return ring[(j + round - 1) % n] ?? null;
}

/** Everyone who paints this owner's canvas, round by round: the credits, in order. */
export function contributionsFor(ring: string[], ownerId: string, totalRounds: number): { round: number; painterId: string }[] {
  const out: { round: number; painterId: string }[] = [];
  for (let round = 1; round <= totalRounds; round++) {
    const painterId = painterOf(ring, ownerId, round);
    if (painterId) out.push({ round, painterId });
  }
  return out;
}

/** "Maya, with the help of Jordan, Ari and Sam" (helpers in the order they painted). */
export function creditLine(ownerName: string, helperNames: string[]): string {
  const helpers = [...new Set(helperNames.filter((name) => name && name !== ownerName))];
  if (!helpers.length) return ownerName;
  const list = helpers.length === 1 ? helpers[0]! : `${helpers.slice(0, -1).join(', ')} and ${helpers[helpers.length - 1]}`;
  return `${ownerName}, with the help of ${list}`;
}
