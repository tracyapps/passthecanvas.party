// The message protocol between browsers and the party server.
// Every message is JSON with a `type` field. Change shapes HERE first,
// then update apps/web and apps/server in the same change.

/** The canvas is always 1600×1200 "canvas units", whatever the screen size. */
export const CANVAS_WIDTH = 1600;
export const CANVAS_HEIGHT = 1200;

export type ToolId = 'pencil' | 'round' | 'flat' | 'wash' | 'eraser';

/** One point of a stroke, in canvas units. pressure is 0–1 (0.5 for a mouse). */
export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

/** A batch of points from one continuous drag, plus the brush settings used. */
export interface Stroke {
  id: string;
  tool: ToolId;
  color: string; // hex, e.g. "#2c3f9e"
  size: number; // 2–80
  flow: number; // 0.1–1
  points: StrokePoint[];
  /** true on the last batch of a drag (pointer lifted) */
  done: boolean;
}

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
  /** URL of the latest saved canvas image, for late joiners */
  snapshotUrl: string | null;
  radio: { stationName: string; streamUrl: string; playing: boolean } | null;
}

// ---------- browser → server ----------

export type ClientMessage =
  | { type: 'join'; name: string; presence: Presence }
  | { type: 'start' } // host only
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
  | { type: 'stroke'; stroke: Stroke; painterId: string }
  | { type: 'timer'; secondsLeft: number }
  | { type: 'requestSnapshot'; round: number }
  | { type: 'chat'; fromId: string; name: string; text: string; at: number }
  | { type: 'error'; message: string };
