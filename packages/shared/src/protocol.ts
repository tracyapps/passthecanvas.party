// The message protocol between browsers and the party server.
// Every message is JSON with a `type` field. Change shapes HERE first,
// then update apps/web and apps/server in the same change.
//
// The game: everyone starts their own canvas. Each round, everyone paints at
// the same time on the canvas in front of them; then every canvas passes one
// seat clockwise (see ./ring.ts). After N + 1 rounds each canvas is back with
// its owner, who paints the last layer.

import type { CanvasShape, PaintedStroke, Stroke } from './paint';
import type { OrderMode } from './ring';
import type { InitialsColor, PartyTiming } from './community';

// Strokes, tools and canvas shapes live in ./paint.ts; ring math in ./ring.ts.

export type Presence = 'camera' | 'avatar';

/** Gallery hang modes: walls first with lean overflow, walls only, or lean spaces only. */
export type GalleryMode = 'walls-then-lean' | 'walls' | 'lean';
export const GALLERY_MODES: GalleryMode[] = ['walls-then-lean', 'walls', 'lean'];

export interface Member {
  id: string;
  name: string;
  presence: Presence;
  isHost: boolean;
  spotId: string | null; // which spot in the 360° room, from spots.json
  /** The shape this artist wants for their own canvas (chosen in the lobby). */
  canvasShape: CanvasShape;
  /** Joined after the game started: watches, but has no canvas this party. */
  watching: boolean;
  /** The color behind their initials (when there's no picture to show). */
  initialsColor: InitialsColor;
  /** They shared a picture for avatar mode (a cutout or photo); see the `looks` messages. */
  hasLook: boolean;
}

/**
 * A guest's avatar picture: a small PNG/JPEG/WebP data URL, made in their
 * browser from their cutout avatar or profile photo. Sent once and kept out
 * of the party state so state updates stay small.
 */
export const LOOK_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_LOOK_CHARS = 90_000;
export interface Look {
  initialsColor: InitialsColor;
  image: string | null;
}

/** One artist's canvas and its story, round by round. */
export interface Piece {
  id: string; // "c1", "c2"…
  ownerId: string;
  ownerName: string;
  shape: CanvasShape;
  width: number;
  height: number;
  /** Every planned turn on this canvas, in order. `url` is the saved image after that turn. */
  turns: { round: number; painterId: string; painterName: string; url: string | null }[];
}

export interface PartyState {
  partyId: string;
  /** The room this party is in (folder under public/studio/). */
  room: string;
  members: Member[];
  /** The passing ring: canvases pass from each person to the next. Frozen when the game starts. */
  order: string[];
  orderMode: OrderMode;
  phase: 'lobby' | 'painting' | 'passing' | 'reveal';
  round: number; // 1-based
  totalRounds: number;
  /** This round: member id → the canvas id in front of them. */
  assignments: Record<string, string>;
  /** Members who have passed their canvas this round. */
  passed: string[];
  pieces: Piece[];
  secondsLeft: number;
  /** This round's turn length (worked out from `timing`). */
  turnSeconds: number;
  /** The host's timing: a set party length, or a set turn length. Changeable mid-party. */
  timing: PartyTiming;
  /** When the first round started, and when the painting is planned to finish (ms since epoch). */
  startedAt: number | null;
  plannedEndAt: number | null;
  /**
   * The timer reached zero. Zero is a gentle cue, not a lock: painters keep
   * their canvas until they pass (or the host passes everyone on).
   */
  overtime: boolean;
  /** How the host hangs the finished art in the gallery; every guest follows. */
  galleryMode: GalleryMode;
  radio: { stationName: string; streamUrl: string; playing: boolean } | null;
  /**
   * The party's saved gallery, once the host chose to keep one (reveal only).
   * `available` is false when the server has no archive storage connected.
   */
  archive: { available: boolean; saving: boolean; id: string | null; error: string | null };
}

// ---------- browser → server ----------

export type ClientMessage =
  | { type: 'join'; name: string; presence: Presence; look?: Look }
  | { type: 'start' } // host only
  | { type: 'setMyCanvas'; shape: CanvasShape } // anyone, lobby only: the shape of your own canvas
  | { type: 'setTurnSeconds'; seconds: number } // host only, lobby only
  | { type: 'setOrderMode'; mode: OrderMode } // host only, lobby only
  | { type: 'setOrder'; order: string[] } // host only, lobby only: same people, new order (becomes "custom")
  | { type: 'setGalleryMode'; mode: GalleryMode } // host only
  | { type: 'stroke'; stroke: Stroke } // only onto the canvas in front of you
  | { type: 'passNow' } // "I'm done with this canvas" (send any unfinished stroke first)
  | { type: 'passEveryone' } // host only: move the round on for anyone still painting
  | { type: 'snapshot'; round: number; canvasId: string; pngDataUrl: string } // when asked
  | { type: 'watch'; canvasId: string | null } // follow a canvas live (late joiners, the reveal)
  | { type: 'takeSpot'; spotId: string }
  | { type: 'chat'; text: string }
  | { type: 'setRadio'; stationName: string; streamUrl: string; playing: boolean } // host only
  | { type: 'saveArchive' } // host only, at the reveal
  | { type: 'setTiming'; timing: PartyTiming } // host only; any time before the reveal
  | { type: 'setPresence'; presence: Presence } // swap camera ↔ avatar, any time
  | { type: 'setLook'; look: Look };

// ---------- server → browser ----------

export type ServerMessage =
  | { type: 'welcome'; youId: string; state: PartyState }
  | { type: 'state'; state: PartyState }
  /** A stroke on a canvas you are watching. */
  | { type: 'stroke'; stroke: PaintedStroke }
  /**
   * Everything painted on one canvas so far: sent when it lands in front of
   * you, and when you start watching it. `complete: false` means it grew past
   * the history limit; draw `baseUrl` (its latest saved image) as a protected
   * base, then the strokes.
   */
  | { type: 'canvasHistory'; canvasId: string; strokes: PaintedStroke[]; complete: boolean; baseUrl: string | null }
  | { type: 'timer'; secondsLeft: number }
  | { type: 'requestSnapshot'; round: number; canvasId: string }
  | { type: 'chat'; fromId: string; name: string; text: string; at: number }
  | { type: 'archiveSaved'; id: string; deleteKey: string } // to the host only: the private delete link
  | { type: 'looks'; looks: Record<string, string> } // on joining: everyone's avatar pictures
  | { type: 'look'; memberId: string; image: string | null }
  | { type: 'error'; message: string };
