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
  /**
   * Every device of theirs lost its connection a while ago. Their seat is
   * kept for a grace period; an away artist sits out the next round.
   */
  away: boolean;
}

// ---------- your devices (one artist, several screens) ----------

/**
 * One artist can use more than one device or window: a tablet for the canvas,
 * a laptop or phone for the room and video. The server gives each duty to
 * exactly one device: `canvas` (the only device whose strokes count) and
 * `call` (the only device that joins the video call as this artist).
 */
export type DeviceDuty = 'canvas' | 'call';
/** What a new linked device takes over: the canvas, or the room and video. */
export type LinkRole = 'canvas' | 'room';
export const LINK_ROLES: LinkRole[] = ['canvas', 'room'];

/** One of your devices, as the server sees it. Sent only to you. */
export interface MyDevice {
  id: string;
  label: string; // "iPad", "Mac", "Mac (window)"…
  canvas: boolean;
  call: boolean;
  online: boolean;
}

/** Link codes: 6 letters and digits, no look-alikes (no I, O, 0, 1). */
export const LINK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LINK_CODE = /^[A-HJ-NP-Z2-9]{6}$/;
/** A link code works once, for this long. */
export const LINK_SECONDS = 300;
/** At most this many devices per artist. */
export const MAX_DEVICES = 4;

/** Tidy a typed code: capitals, no spaces or dashes. */
export function normalizeLinkCode(raw: string): string {
  return String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

/** A short, friendly device name from the browser's user agent. */
export function deviceLabel(userAgent: string, touchPoints = 0): string {
  const ua = String(userAgent ?? '');
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux computer';
  return 'Browser';
}

/** A device label from a browser: printable, short. */
export function cleanDeviceLabel(raw: unknown): string {
  return String(raw ?? '').replace(/[^\p{L}\p{N} ()'.,+-]/gu, '').trim().slice(0, 40) || 'Browser';
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
  | { type: 'join'; name: string; presence: Presence; look?: Look; device?: string }
  /** Back after a dropped connection or a reload: the private key from `welcome`. */
  | { type: 'rejoin'; memberId: string; deviceId: string; key: string }
  /** Join as one of an artist's devices, with a code from `makeLink`. */
  | { type: 'redeemLink'; code: string; device?: string }
  /** Make a one-time code for another device or window. */
  | { type: 'makeLink'; role: LinkRole }
  | { type: 'cancelLink' }
  /** "Paint here" / "Video here": move a duty to this device. */
  | { type: 'takeDuty'; duty: DeviceDuty }
  /** Disconnect one of your other devices (its key stops working). */
  | { type: 'unlinkDevice'; deviceId: string }
  /** Leaving on purpose: this device goes now (and you, if it was your last). */
  | { type: 'leave' }
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
  /**
   * You're in. `session` is private to this device: keep it (in this tab
   * only) to rejoin after a dropped connection or a reload.
   */
  | { type: 'welcome'; youId: string; state: PartyState; session: { deviceId: string; key: string } }
  /** Your devices and which one holds the canvas and the call. Sent only to you. */
  | { type: 'devices'; youDeviceId: string; devices: MyDevice[] }
  /** Your one-time link code (null: cancelled, used or expired). */
  | { type: 'linkCode'; link: { code: string; role: LinkRole; expiresAt: number } | null }
  /** The canvas device should finish its stroke and pass (another of your devices asked). */
  | { type: 'passRequest' }
  /** A join, rejoin or link was refused. The browser goes back to the join screen. */
  | { type: 'rejected'; reason: 'rejoin' | 'link' | 'full'; message: string }
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
