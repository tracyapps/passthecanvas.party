// The message protocol between browsers and the party server.
// Every message is JSON with a `type` field. Change shapes HERE first,
// then update apps/web and apps/server in the same change.

import type { CanvasShape, CanvasSize, PaintedStroke, Stroke } from './paint';

// Strokes, tools and canvas shapes live in ./paint.ts (shared rules for the
// painting table). This file is only the messages.

export type Presence = 'camera' | 'avatar';

export interface Member {
  id: string;
  name: string;
  presence: Presence;
  isHost: boolean;
  spotId: string | null; // which spot in the 360° room, from spots.json
}

export interface PartyState {
  partyId: string;
  members: Member[];
  /** member ids in passing order */
  order: string[];
  phase: 'lobby' | 'painting' | 'passing' | 'reveal';
  round: number; // 1-based
  totalRounds: number;
  painterId: string | null;
  secondsLeft: number;
  turnSeconds: number;
  /** The canvas shape for this party. The host picks it in the lobby. */
  canvas: CanvasSize & { shape: CanvasShape };
  /** URL of the latest saved canvas image (reveal, gallery, history fallback) */
  snapshotUrl: string | null;
  /** One saved image per finished turn, oldest first, for the reveal gallery. */
  rounds: { round: number; painterId: string; painterName: string; url: string }[];
  radio: { stationName: string; streamUrl: string; playing: boolean } | null;
}

// ---------- browser → server ----------

export type ClientMessage =
  | { type: 'join'; name: string; presence: Presence }
  | { type: 'start' } // host only
  | { type: 'setCanvas'; shape: CanvasShape } // host only, lobby only
  | { type: 'stroke'; stroke: Stroke } // current painter only
  | { type: 'passNow' } // painter or host
  | { type: 'snapshot'; round: number; pngDataUrl: string } // painter, when asked
  | { type: 'takeSpot'; spotId: string }
  | { type: 'chat'; text: string }
  | { type: 'setRadio'; stationName: string; streamUrl: string; playing: boolean }; // host only

// ---------- server → browser ----------

export type ServerMessage =
  | { type: 'welcome'; youId: string; state: PartyState }
  | { type: 'state'; state: PartyState }
  | { type: 'stroke'; stroke: PaintedStroke }
  /**
   * Sent once after `welcome`: every accepted stroke so far, so a late joiner
   * rebuilds each turn's own layer. `complete: false` means the party grew
   * past the history limit; draw `snapshotUrl` as a protected base instead.
   */
  | { type: 'history'; strokes: PaintedStroke[]; complete: boolean }
  | { type: 'timer'; secondsLeft: number }
  | { type: 'requestSnapshot'; round: number }
  | { type: 'chat'; fromId: string; name: string; text: string; at: number }
  | { type: 'error'; message: string };
