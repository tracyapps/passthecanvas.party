// One Party = one game room. It owns the members, the passing ring, the
// rounds and the timer. The server is the source of truth: browsers ask, the
// party decides.
//
// The game (see packages/shared/src/ring.ts): everyone starts their own
// canvas. Each round everyone paints at the same time on the canvas in front
// of them; when everyone has passed, every canvas moves one seat clockwise.
// N artists → N + 1 rounds, so each owner paints the first and last layer.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebSocket } from 'ws';
import {
  CANVAS_ID,
  CANVAS_SHAPES,
  cleanDeviceLabel,
  LINK_ROLES,
  MAX_DEVICES,
  normalizeLinkCode,
  type DeviceDuty,
  type MyDevice,
  canvasOwnerFor,
  clampTurnSeconds,
  cleanTiming,
  DEFAULT_TIMING,
  INITIALS_COLOR_KEYS,
  LOOK_IMAGE,
  MAX_LOOK_CHARS,
  PASS_SECONDS,
  planTiming,
  turnSecondsForRest,
  type InitialsColor,
  type Look,
  type PartyTiming,
  contributionsFor,
  DEFAULT_CANVAS_SHAPE,
  GALLERY_MODES,
  ORDER_MODES,
  reorder,
  roundsFor,
  sanitizeSpots,
  sanitizeStroke,
  seatRing,
  shuffledRing,
  type ClientMessage,
  type Member,
  type PaintedStroke,
  type PartyState,
  type Piece,
  type ServerMessage
} from '@ptc/shared';

import { archiveConfigured, buildArchive, saveArchive } from './archive.ts';
import { allowAttempt, cancelLink, createLink, takeLink } from './links.ts';

// Connections drop: phones sleep, wifi blinks, someone reloads. An artist's
// seat (and canvas) waits for them instead of vanishing.
/** How long a device can be gone before its duties move and its artist counts as away. */
const DEVICE_GRACE_MS = Number(process.env.DEVICE_GRACE_SECONDS ?? 45) * 1000;
/** How long an away artist keeps their place before they leave the party. */
const LOBBY_AWAY_MS = Number(process.env.LOBBY_AWAY_SECONDS ?? 120) * 1000;
const GAME_AWAY_MS = Number(process.env.GAME_AWAY_SECONDS ?? 15 * 60) * 1000;

/** One of an artist's devices (or windows). Only a hash of its rejoin key is kept. */
interface Device {
  id: string;
  label: string;
  keyHash: Buffer;
  ws: WebSocket | null;
  /** When it went offline (null while connected). */
  offlineAt: number | null;
}

/** An artist's devices, and which one holds the canvas and which the call. */
interface Session {
  devices: Map<string, Device>;
  canvas: string | null;
  call: string | null;
  graceTimer: ReturnType<typeof setTimeout> | null;
  awayTimer: ReturnType<typeof setTimeout> | null;
}

const hashKey = (key: string) => createHash('sha256').update(key).digest();
const sameKey = (key: unknown, hash: Buffer) => typeof key === 'string' && key.length <= 100 && timingSafeEqual(hashKey(key), hash);

/** A look from a browser: a known initials color and, maybe, a small image data URL. */
function cleanLook(look: unknown): Look {
  const raw = (look && typeof look === 'object' ? look : {}) as Record<string, unknown>;
  const initialsColor = INITIALS_COLOR_KEYS.includes(raw.initialsColor as InitialsColor) ? (raw.initialsColor as InitialsColor) : 'teal';
  const image = typeof raw.image === 'string' && raw.image.length <= MAX_LOOK_CHARS && LOOK_IMAGE.test(raw.image) ? raw.image : null;
  return { initialsColor, image };
}

export const SNAPSHOT_DIR = join(process.cwd(), 'data', 'snapshots');
const STUDIO_DIR = fileURLToPath(new URL('../../web/public/studio', import.meta.url));
const TURN_SECONDS = Number(process.env.TURN_SECONDS ?? 90);
const DEFAULT_ROOM = 'cream-city';
// Each canvas keeps its strokes so the next painter (and anyone watching) can
// rebuild it with every turn's own layer. Past this many stamps a canvas stops
// keeping history, and its latest saved image becomes a protected base.
const MAX_CANVAS_STAMPS = 300_000;
const MAX_SNAPSHOT_CHARS = 3_500_000; // about 2.5 MB of PNG
const PASS_CARD_MS = PASS_SECONDS * 1000; // the 'pass the canvas' card; timing plans count it

const parties = new Map<string, Party>();

export function getParty(id: string): Party {
  let party = parties.get(id);
  if (!party) {
    party = new Party(id);
    parties.set(id, party);
  }
  return party;
}

interface CanvasHistory {
  strokes: PaintedStroke[];
  stamps: number;
  complete: boolean;
}

class Party {
  /** memberId → their devices. */
  private sessions = new Map<string, Session>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private passTimer: ReturnType<typeof setTimeout> | null = null;
  private state: PartyState;
  /** Painting data per canvas. Never video or audio; dropped when the party ends. */
  private histories = new Map<string, CanvasHistory>();
  /** Which device is following which canvas live (besides its painter): deviceId → canvas. */
  private watchers = new Map<string, { memberId: string; canvasId: string }>();
  /** Avatar pictures by member id (kept out of the state; see Look). */
  private looks = new Map<string, string>();
  /** Seat angles from the room's spots.json, for the clockwise ring. */
  private yawOf: Record<string, number> = {};

  constructor(id: string) {
    this.state = {
      partyId: id,
      room: DEFAULT_ROOM,
      members: [],
      order: [],
      orderMode: 'seats',
      phase: 'lobby',
      round: 1,
      totalRounds: 0,
      assignments: {},
      passed: [],
      pieces: [],
      secondsLeft: TURN_SECONDS,
      turnSeconds: TURN_SECONDS,
      timing: { ...DEFAULT_TIMING, turnSeconds: TURN_SECONDS },
      startedAt: null,
      plannedEndAt: null,
      overtime: false,
      galleryMode: 'walls-then-lean',
      radio: null,
      archive: { available: archiveConfigured(), saving: false, id: null, error: null }
    };
    void this.loadSeats();
  }

  /** Read the room's seat angles once. Without them, the ring falls back to arrival order. */
  private async loadSeats() {
    try {
      const file = sanitizeSpots(JSON.parse(await readFile(join(STUDIO_DIR, this.state.room, 'spots.json'), 'utf8')));
      this.yawOf = Object.fromEntries((file?.spots ?? []).map((spot) => [spot.id, spot.yaw]));
      this.refreshLobbyOrder();
      this.broadcastState();
    } catch {
      this.yawOf = {};
    }
  }

  /**
   * A browser connected. It becomes a member with `join`, comes back with
   * `rejoin`, or joins as one of an artist's devices with `redeemLink`.
   */
  connect(ws: WebSocket, address = '') {
    let memberId: string | null = null;
    let deviceId: string | null = null;
    let refused = 0;
    const refuse = (reason: 'rejoin' | 'link' | 'full', message: string) => {
      this.send(ws, { type: 'rejected', reason, message });
      refused += 1;
      if (refused >= 3) ws.close();
    };

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return this.send(ws, { type: 'error', message: 'Bad message' });
      }

      if (!memberId) {
        if (msg.type === 'join') {
          ({ memberId, deviceId } = this.addMember(ws, msg.name, msg.presence, msg.look, msg.device));
        } else if (msg.type === 'rejoin') {
          const back = this.rejoin(ws, msg);
          if (back) ({ memberId, deviceId } = back);
          else refuse('rejoin', 'That seat has closed. Join the party again.');
        } else if (msg.type === 'redeemLink') {
          if (!allowAttempt(`link:${address}`)) return refuse('link', 'Too many tries. Wait a few minutes, then make a new code.');
          const linked = this.redeemLink(ws, normalizeLinkCode(msg.code), msg.device);
          if (typeof linked === 'string') refuse(linked === 'full' ? 'full' : 'link', linked === 'full' ? `An artist can use up to ${MAX_DEVICES} devices. Unlink one first.` : 'That code didn\'t work. Codes work once, for 5 minutes. Make a new one on your other device.');
          else ({ memberId, deviceId } = linked);
        } else {
          this.send(ws, { type: 'error', message: 'Join first' });
        }
        return;
      }
      if (msg.type === 'join' || msg.type === 'rejoin' || msg.type === 'redeemLink') return; // already in
      this.handle(memberId, deviceId!, msg);
    });

    ws.on('close', () => {
      if (memberId && deviceId) this.disconnect(memberId, deviceId, ws);
    });
  }

  // ---------- members ----------

  private addMember(ws: WebSocket, rawName: string, presence: Member['presence'], look?: Look, label?: string) {
    const id = randomUUID();
    const name = String(rawName ?? '').trim().slice(0, 40) || 'Guest';
    const isHost = !this.state.members.some((m) => m.isHost); // first one in hosts
    // Arriving after the start means watching this party: the ring is fixed.
    const watching = this.state.phase !== 'lobby';
    const clean = cleanLook(look);
    this.state.members.push({ id, name, presence: presence === 'avatar' ? 'avatar' : 'camera', isHost, spotId: null, canvasShape: DEFAULT_CANVAS_SHAPE, watching, initialsColor: clean.initialsColor, hasLook: !!clean.image, away: false });
    if (clean.image) this.looks.set(id, clean.image);
    const session: Session = { devices: new Map(), canvas: null, call: null, graceTimer: null, awayTimer: null };
    this.sessions.set(id, session);
    const { device, key } = this.newDevice(session, ws, label);
    session.canvas = device.id;
    session.call = device.id;
    this.refreshLobbyOrder();

    this.welcome(id, device, key);
    if (clean.image) this.broadcast({ type: 'look', memberId: id, image: clean.image }, id);
    this.broadcastState();
    return { memberId: id, deviceId: device.id };
  }

  private newDevice(session: Session, ws: WebSocket, label?: string) {
    const key = randomBytes(24).toString('base64url');
    const device: Device = { id: randomUUID(), label: cleanDeviceLabel(label), keyHash: hashKey(key), ws, offlineAt: null };
    session.devices.set(device.id, device);
    return { device, key };
  }

  /** Everything a device needs on arriving: who it is, the party, the pictures, its devices, its canvas. */
  private welcome(memberId: string, device: Device, key: string) {
    const ws = device.ws!;
    this.send(ws, { type: 'welcome', youId: memberId, state: this.state, session: { deviceId: device.id, key } });
    this.send(ws, { type: 'looks', looks: Object.fromEntries(this.looks) });
    this.sendDevices(memberId);
    const canvasId = this.state.assignments[memberId];
    const history = canvasId && this.historyMessage(canvasId);
    if (history) this.send(ws, history);
  }

  /** Back after a dropped connection or a reload, with the device's private key. */
  private rejoin(ws: WebSocket, msg: Extract<ClientMessage, { type: 'rejoin' }>) {
    const session = typeof msg.memberId === 'string' ? this.sessions.get(msg.memberId) : undefined;
    const device = session && typeof msg.deviceId === 'string' ? session.devices.get(msg.deviceId) : undefined;
    const member = this.member(msg.memberId);
    if (!session || !device || !member || !sameKey(msg.key, device.keyHash)) return null;
    // The same device in a second tab (a duplicated tab copies its storage):
    // the newest wins, and the older one is told why.
    if (device.ws && device.ws !== ws) {
      const old = device.ws;
      device.ws = null;
      this.send(old, { type: 'rejected', reason: 'rejoin', message: 'Your seat opened in another tab or window.' });
      old.close();
    }
    device.ws = ws;
    device.offlineAt = null;
    if (!session.canvas) session.canvas = device.id;
    if (!session.call) session.call = device.id;
    this.comeBack(msg.memberId, session);
    this.welcome(msg.memberId, device, msg.key);
    // Whatever this device was watching, again from the top.
    const watched = this.watchers.get(device.id);
    const history = watched && this.historyMessage(watched.canvasId);
    if (history) this.send(ws, history);
    this.broadcastState();
    return { memberId: msg.memberId, deviceId: device.id };
  }

  /** A second device or window joins an artist's seat with a one-time code. */
  private redeemLink(ws: WebSocket, code: string, label?: string): { memberId: string; deviceId: string } | 'bad' | 'full' {
    const ticket = takeLink(code, this.state.partyId);
    const session = ticket && this.sessions.get(ticket.memberId);
    if (!ticket || !session || !this.member(ticket.memberId)) return 'bad';
    // Forget long-gone devices before counting.
    for (const device of [...session.devices.values()]) {
      if (!device.ws && device.id !== session.canvas && device.id !== session.call) session.devices.delete(device.id);
    }
    if (session.devices.size >= MAX_DEVICES) return 'full';
    const { device, key } = this.newDevice(session, ws, label);
    if (ticket.role === 'canvas') session.canvas = device.id;
    else session.call = device.id;
    this.comeBack(ticket.memberId, session);
    this.sendToMember(ticket.memberId, { type: 'linkCode', link: null });
    this.welcome(ticket.memberId, device, key);
    this.broadcastState();
    return { memberId: ticket.memberId, deviceId: device.id };
  }

  /** Someone was away and one of their devices is back. */
  private comeBack(memberId: string, session: Session) {
    if (session.awayTimer) clearTimeout(session.awayTimer);
    if (session.graceTimer) clearTimeout(session.graceTimer);
    session.awayTimer = null;
    session.graceTimer = null;
    const member = this.member(memberId);
    if (member) member.away = false;
  }

  /** A device's connection closed. Its artist stays; their seat waits. */
  private disconnect(memberId: string, deviceId: string, ws: WebSocket) {
    const session = this.sessions.get(memberId);
    const device = session?.devices.get(deviceId);
    if (!session || !device || device.ws !== ws) return; // replaced, unlinked or gone already
    device.ws = null;
    device.offlineAt = Date.now();
    this.sendDevices(memberId);
    if (session.graceTimer) clearTimeout(session.graceTimer);
    session.graceTimer = setTimeout(() => this.settle(memberId), DEVICE_GRACE_MS);
  }

  /**
   * After the grace period: duties held by a device that hasn't come back
   * move to one that's online. With nothing online, the artist is away.
   */
  private settle(memberId: string) {
    const session = this.sessions.get(memberId);
    const member = this.member(memberId);
    if (!session || !member) return;
    session.graceTimer = null;
    const online = [...session.devices.values()].filter((d) => d.ws);
    if (online.length === 0) {
      this.markAway(memberId, session);
      return;
    }
    for (const duty of ['canvas', 'call'] as const) {
      const holder = session[duty] ? session.devices.get(session[duty]!) : undefined;
      if (!holder?.ws) session[duty] = online[0]!.id;
    }
    this.sendDevices(memberId);
  }

  private markAway(memberId: string, session: Session) {
    const member = this.member(memberId);
    if (!member || member.away) return;
    member.away = true;
    // The host role moves on to someone who is here.
    if (member.isHost) {
      const next = this.state.members.find((m) => !m.away);
      if (next) {
        member.isHost = false;
        next.isHost = true;
      }
    }
    session.awayTimer = setTimeout(() => this.removeMember(memberId), this.state.phase === 'lobby' ? LOBBY_AWAY_MS : GAME_AWAY_MS);
    if (this.state.phase === 'lobby') this.refreshLobbyOrder();
    if (this.state.phase === 'painting' && this.everyonePassed()) {
      this.endRound(); // their canvas waits this round out
      return;
    }
    this.broadcastState();
  }

  /** Leaving on purpose, from one device: with others still here, only that device goes. */
  private leaveFrom(memberId: string, deviceId: string) {
    const session = this.sessions.get(memberId);
    if (!session) return;
    const device = session.devices.get(deviceId);
    session.devices.delete(deviceId);
    this.dropWatcher(deviceId);
    device?.ws?.close();
    const online = [...session.devices.values()].filter((d) => d.ws);
    if (online.length === 0) {
      this.removeMember(memberId);
      return;
    }
    if (session.canvas === deviceId) session.canvas = online[0]!.id;
    if (session.call === deviceId) session.call = online[0]!.id;
    this.sendDevices(memberId);
  }

  private dropWatcher(deviceId: string) {
    this.watchers.delete(deviceId);
  }

  private removeMember(id: string) {
    const session = this.sessions.get(id);
    if (session) {
      if (session.awayTimer) clearTimeout(session.awayTimer);
      if (session.graceTimer) clearTimeout(session.graceTimer);
      for (const device of session.devices.values()) {
        this.dropWatcher(device.id);
        device.ws?.close();
      }
    }
    this.sessions.delete(id);
    cancelLink(this.state.partyId, id);
    this.looks.delete(id);
    const wasHost = this.member(id)?.isHost ?? false;
    this.state.members = this.state.members.filter((m) => m.id !== id);

    // Hand the host role on if the host left (to someone who is here, if anyone).
    if (wasHost || !this.state.members.some((m) => m.isHost)) {
      const next = this.state.members.find((m) => !m.away) ?? this.state.members[0];
      if (next) next.isHost = true;
    }

    if (this.state.members.length === 0) {
      this.stopTimer();
      if (this.passTimer) clearTimeout(this.passTimer);
      parties.delete(this.state.partyId);
      return;
    }
    if (this.state.phase === 'lobby') {
      this.refreshLobbyOrder();
    } else if (this.state.phase === 'painting' && this.everyonePassed()) {
      // Someone left mid-round: their canvas waits this round out.
      this.endRound();
      return;
    }
    this.broadcastState();
  }

  private member(id: string) {
    return this.state.members.find((m) => m.id === id);
  }

  /** Here (or only just dropped and likely back): gets a canvas, counts for passing. */
  private present(id: string) {
    const member = this.member(id);
    return !!member && !member.away && this.sessions.has(id);
  }

  /** Lobby only: keep the ring matching the people (and seats) in the room. */
  private refreshLobbyOrder() {
    if (this.state.phase !== 'lobby') return;
    const artists = this.state.members.filter((m) => !m.watching && !m.away).map((m) => m.id);
    if (this.state.orderMode === 'seats') {
      this.state.order = seatRing(artists, (id) => this.member(id)?.spotId ?? null, this.yawOf);
    } else {
      // Random and custom rings keep their order; newcomers join the end, leavers drop out.
      const kept = this.state.order.filter((id) => artists.includes(id));
      this.state.order = [...kept, ...artists.filter((id) => !kept.includes(id))];
    }
    this.applyLobbyTiming();
  }

  /** Lobby: the turn length follows the timing and the number of artists. */
  private applyLobbyTiming() {
    const plan = planTiming(this.state.timing, this.state.order.length);
    this.state.turnSeconds = plan.turnSeconds;
    this.state.secondsLeft = plan.turnSeconds;
  }

  /**
   * Mid-party, a set party length re-shares the time left among the rounds
   * still to paint, so a slow round (or a late change) evens out. A set turn
   * length just moves the planned end.
   */
  private applyPartyTiming(roundsLeft: number) {
    const timing = this.state.timing;
    const now = Date.now();
    if (timing.mode === 'party' && this.state.startedAt) {
      this.state.plannedEndAt = this.state.startedAt + (timing.partyMinutes - timing.introMinutes) * 60_000;
      this.state.turnSeconds = turnSecondsForRest(timing, roundsLeft, (this.state.plannedEndAt - now) / 1000);
    } else {
      this.state.turnSeconds = timing.turnSeconds;
      this.state.plannedEndAt = now + (roundsLeft * (timing.turnSeconds + PASS_SECONDS) + timing.wrapMinutes * 60) * 1000;
    }
  }

  // ---------- messages ----------

  private handle(fromId: string, fromDevice: string, msg: ClientMessage) {
    const from = this.member(fromId);
    const session = this.sessions.get(fromId);
    if (!from || !session) return;
    /** Only one device per artist paints: the one holding the canvas. */
    const onCanvas = session.canvas === fromDevice;
    const lobbyHost = from.isHost && this.state.phase === 'lobby';

    switch (msg.type) {
      case 'makeLink': {
        if (!LINK_ROLES.includes(msg.role)) return;
        const link = createLink(this.state.partyId, fromId, msg.role);
        this.sendToMember(fromId, { type: 'linkCode', link: { code: link.code, role: link.role, expiresAt: link.expiresAt } });
        return;
      }

      case 'cancelLink': {
        cancelLink(this.state.partyId, fromId);
        this.sendToMember(fromId, { type: 'linkCode', link: null });
        return;
      }

      case 'takeDuty': {
        if (msg.duty !== 'canvas' && msg.duty !== 'call') return;
        session[msg.duty as DeviceDuty] = fromDevice;
        this.sendDevices(fromId);
        return;
      }

      case 'unlinkDevice': {
        const other = typeof msg.deviceId === 'string' && msg.deviceId !== fromDevice ? session.devices.get(msg.deviceId) : undefined;
        if (!other) return;
        session.devices.delete(other.id);
        this.dropWatcher(other.id);
        if (other.ws) {
          this.send(other.ws, { type: 'rejected', reason: 'link', message: 'This device was unlinked from your seat.' });
          other.ws.close();
        }
        if (session.canvas === other.id) session.canvas = fromDevice;
        if (session.call === other.id) session.call = fromDevice;
        this.sendDevices(fromId);
        return;
      }

      case 'leave': {
        this.leaveFrom(fromId, fromDevice);
        return;
      }

      case 'start': {
        if (!lobbyHost || this.state.order.length === 0) return;
        this.startGame();
        return;
      }

      case 'setMyCanvas': {
        if (this.state.phase !== 'lobby' || !CANVAS_SHAPES[msg.shape]) return;
        from.canvasShape = msg.shape;
        this.broadcastState();
        return;
      }

      case 'setTurnSeconds': {
        // The older lobby control: a set turn length.
        if (!lobbyHost) return;
        const seconds = clampTurnSeconds(msg.seconds);
        if (seconds === null) return;
        this.setTiming({ ...this.state.timing, mode: 'turn', turnSeconds: seconds });
        return;
      }

      case 'setTiming': {
        if (!from.isHost || this.state.phase === 'reveal') return;
        const timing = cleanTiming(msg.timing);
        if (timing) this.setTiming(timing);
        return;
      }

      case 'setPresence': {
        if (msg.presence !== 'camera' && msg.presence !== 'avatar') return;
        from.presence = msg.presence;
        this.broadcastState();
        return;
      }

      case 'setLook': {
        const clean = cleanLook(msg.look);
        from.initialsColor = clean.initialsColor;
        from.hasLook = !!clean.image;
        if (clean.image) this.looks.set(fromId, clean.image);
        else this.looks.delete(fromId);
        this.broadcast({ type: 'look', memberId: fromId, image: clean.image });
        this.broadcastState();
        return;
      }

      case 'setOrderMode': {
        if (!lobbyHost || !ORDER_MODES.includes(msg.mode)) return;
        this.state.orderMode = msg.mode;
        if (msg.mode === 'random') this.state.order = shuffledRing(this.state.order);
        this.refreshLobbyOrder();
        this.broadcastState();
        return;
      }

      case 'setOrder': {
        if (!lobbyHost) return;
        const order = reorder(this.state.order, msg.order);
        if (!order) return;
        this.state.order = order;
        this.state.orderMode = 'custom';
        this.broadcastState();
        return;
      }

      case 'setGalleryMode': {
        if (!from.isHost || !GALLERY_MODES.includes(msg.mode)) return;
        this.state.galleryMode = msg.mode;
        this.broadcastState();
        return;
      }

      case 'stroke': {
        // Only onto the canvas in front of you, this round. During "passing"
        // the end of a stroke already in flight is still accepted; the cutoff
        // is the next round.
        const open = this.state.phase === 'painting' || this.state.phase === 'passing';
        const canvasId = this.state.assignments[fromId];
        if (!open || !onCanvas || !canvasId || msg.stroke?.canvasId !== canvasId) return;
        const piece = this.piece(canvasId);
        const clean = piece && sanitizeStroke(msg.stroke, piece);
        if (!clean) return;
        // The server, not the browser, says whose turn (and so whose layer) it is.
        const stroke: PaintedStroke = { ...clean, painterId: fromId, round: this.state.round };
        this.remember(stroke);
        const data = JSON.stringify({ type: 'stroke', stroke } satisfies ServerMessage);
        // Your other devices mirror your canvas.
        for (const device of session.devices.values()) {
          if (device.id !== fromDevice && device.ws?.readyState === device.ws?.OPEN) device.ws?.send(data);
        }
        for (const [watcherDevice, watched] of this.watchers) {
          if (watched.canvasId !== canvasId || watched.memberId === fromId) continue;
          const ws = this.sessions.get(watched.memberId)?.devices.get(watcherDevice)?.ws;
          if (ws?.readyState === ws?.OPEN) ws?.send(data);
        }
        return;
      }

      case 'passNow': {
        if (this.state.phase !== 'painting' || !this.state.assignments[fromId] || this.state.passed.includes(fromId)) return;
        // Asked from another of your devices: the canvas device finishes its
        // stroke first, then passes. If it's offline, pass now.
        const canvasWs = session.canvas ? session.devices.get(session.canvas)?.ws : null;
        if (!onCanvas && canvasWs) {
          this.send(canvasWs, { type: 'passRequest' });
          return;
        }
        this.state.passed = [...this.state.passed, fromId];
        if (this.everyonePassed()) this.endRound();
        else this.broadcastState();
        return;
      }

      case 'passEveryone': {
        if (!from.isHost || this.state.phase !== 'painting') return;
        this.endRound();
        return;
      }

      case 'snapshot': {
        // Only the painter of that canvas, for this round, when asked.
        if (msg.round !== this.state.round || this.state.assignments[fromId] !== msg.canvasId) return;
        const canvasOnline = !!(session.canvas && session.devices.get(session.canvas)?.ws);
        if (!onCanvas && canvasOnline) return; // the canvas device answers
        void this.saveSnapshot(msg.round, msg.canvasId, msg.pngDataUrl);
        return;
      }

      case 'watch': {
        if (msg.canvasId === null) {
          this.watchers.delete(fromDevice);
          return;
        }
        if (typeof msg.canvasId !== 'string' || !this.piece(msg.canvasId)) return;
        this.watchers.set(fromDevice, { memberId: fromId, canvasId: msg.canvasId });
        const history = this.historyMessage(msg.canvasId);
        const ws = session.devices.get(fromDevice)?.ws;
        if (history && ws) this.send(ws, history);
        return;
      }

      case 'takeSpot': {
        const taken = this.state.members.some((m) => m.spotId === msg.spotId && m.id !== fromId);
        if (taken || typeof msg.spotId !== 'string' || msg.spotId.length > 60) return;
        from.spotId = msg.spotId;
        this.refreshLobbyOrder();
        this.broadcastState();
        return;
      }

      case 'chat': {
        const text = String(msg.text ?? '').trim().slice(0, 500);
        if (!text) return;
        this.broadcast({ type: 'chat', fromId, name: from.name, text, at: Date.now() });
        return;
      }

      case 'saveArchive': {
        if (!from.isHost || this.state.phase !== 'reveal' || this.state.archive.saving || this.state.archive.id || !this.state.archive.available) return;
        void this.archive(fromId);
        return;
      }

      case 'setRadio': {
        if (!from.isHost) return;
        // https streams only, and a real URL of sane length. We never fetch it:
        // each guest's browser plays the station itself.
        if (typeof msg.streamUrl !== 'string' || msg.streamUrl.length > 2000 || !/^https:\/\//.test(msg.streamUrl)) return;
        try { new URL(msg.streamUrl); } catch { return; }
        this.state.radio = {
          stationName: String(msg.stationName).slice(0, 80),
          streamUrl: msg.streamUrl,
          playing: Boolean(msg.playing)
        };
        this.broadcastState();
        return;
      }
    }
  }

  // ---------- the game ----------

  private piece(canvasId: string): Piece | undefined {
    return this.state.pieces.find((p) => p.id === canvasId);
  }

  /** Freeze the ring and give every artist their own canvas. */
  private startGame() {
    const ring = this.state.order.filter((id) => this.present(id));
    const total = roundsFor(ring.length);
    const nameOf = (id: string) => this.member(id)?.name ?? 'A guest';
    this.state.order = ring;
    this.state.totalRounds = total;
    this.state.archive = { ...this.state.archive, saving: false, id: null, error: null };
    this.state.pieces = ring.map((ownerId, index) => {
      const shape = this.member(ownerId)?.canvasShape ?? DEFAULT_CANVAS_SHAPE;
      return {
        id: `c${index + 1}`,
        ownerId,
        ownerName: nameOf(ownerId),
        shape,
        width: CANVAS_SHAPES[shape].width,
        height: CANVAS_SHAPES[shape].height,
        turns: contributionsFor(ring, ownerId, total).map((turn) => ({ ...turn, painterName: nameOf(turn.painterId), url: null }))
      };
    });
    for (const piece of this.state.pieces) this.histories.set(piece.id, { strokes: [], stamps: 0, complete: true });
    this.state.round = 1;
    this.state.startedAt = Date.now();
    this.startRound();
  }

  private startRound() {
    const ring = this.state.order;
    this.state.phase = 'painting';
    this.state.assignments = {};
    for (const painterId of ring) {
      if (!this.present(painterId)) continue; // away: that canvas waits this round
      const ownerId = canvasOwnerFor(ring, painterId, this.state.round);
      const piece = this.state.pieces.find((p) => p.ownerId === ownerId);
      if (piece) this.state.assignments[painterId] = piece.id;
    }
    this.state.passed = [];
    this.applyPartyTiming(this.state.totalRounds - this.state.round + 1);
    this.state.secondsLeft = this.state.turnSeconds;
    this.state.overtime = false;
    this.broadcastState();
    // Each painter gets the canvas now in front of them, with every earlier layer.
    for (const [painterId, canvasId] of Object.entries(this.state.assignments)) {
      for (const deviceId of this.sessions.get(painterId)?.devices.keys() ?? []) this.watchers.delete(deviceId);
      const history = this.historyMessage(canvasId);
      if (history) this.sendToMember(painterId, history);
    }
    if (Object.keys(this.state.assignments).length === 0) this.endRound();
    else this.startTimer();
  }

  private everyonePassed() {
    return Object.keys(this.state.assignments).every((id) => !this.present(id) || this.state.passed.includes(id));
  }

  private startTimer() {
    this.stopTimer();
    this.ticker = setInterval(() => {
      this.state.secondsLeft -= 1;
      this.broadcast({ type: 'timer', secondsLeft: this.state.secondsLeft });
      // Zero is a gentle cue: stop the clock and let everyone finish and pass.
      if (this.state.secondsLeft <= 0) {
        this.stopTimer();
        this.state.secondsLeft = 0;
        this.state.overtime = true;
        this.broadcastState();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /** Everyone passed (or the host moved it on): save each canvas, then pass them all. */
  private endRound() {
    if (this.state.phase !== 'painting') return;
    this.stopTimer();
    this.state.phase = 'passing';
    this.state.overtime = false;
    for (const [painterId, canvasId] of Object.entries(this.state.assignments)) {
      this.sendToDuty(painterId, 'canvas', { type: 'requestSnapshot', round: this.state.round, canvasId });
    }
    this.broadcastState();
    // Give everyone a moment to see the "pass the canvas" card.
    this.passTimer = setTimeout(() => this.nextRound(), PASS_CARD_MS);
  }

  private nextRound() {
    this.passTimer = null;
    if (this.state.round >= this.state.totalRounds) {
      this.state.phase = 'reveal';
      this.state.assignments = {};
      this.state.passed = [];
      this.stopTimer();
      this.broadcastState();
      return;
    }
    this.state.round += 1;
    this.startRound();
  }

  // ---------- canvases ----------

  private remember(stroke: PaintedStroke) {
    const history = this.histories.get(stroke.canvasId);
    if (!history || !history.complete) return;
    history.stamps += stroke.stamps.length;
    if (history.stamps > MAX_CANVAS_STAMPS) {
      // Too big to replay: free it; the latest saved image becomes the base.
      history.strokes = [];
      history.complete = false;
      return;
    }
    history.strokes.push(stroke);
  }

  /** Everything painted on a canvas so far, as one message. */
  private historyMessage(canvasId: string): ServerMessage | null {
    const history = this.histories.get(canvasId);
    const piece = this.piece(canvasId);
    if (!history || !piece) return null;
    const baseUrl = [...piece.turns].reverse().find((turn) => turn.url)?.url ?? null;
    return { type: 'canvasHistory', canvasId, strokes: history.complete ? history.strokes : [], complete: history.complete, baseUrl };
  }

  private async saveSnapshot(round: number, canvasId: string, dataUrl: string) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_SNAPSHOT_CHARS || !CANVAS_ID.test(canvasId)) return;
    const prefix = 'data:image/png;base64,';
    if (!dataUrl.startsWith(prefix) || !Number.isInteger(round) || round < 1 || round > 999) return;
    const piece = this.piece(canvasId);
    const turn = piece?.turns.find((t) => t.round === round);
    if (!piece || !turn) return;

    const dir = join(SNAPSHOT_DIR, this.state.partyId);
    await mkdir(dir, { recursive: true });
    const file = `${canvasId}-r${round}.png`;
    await writeFile(join(dir, file), Buffer.from(dataUrl.slice(prefix.length), 'base64'));
    turn.url = `/snapshots/${this.state.partyId}/${file}`;
    this.broadcastState();
  }

  /** The host changed the timing: everyone's display follows at once. */
  private setTiming(timing: PartyTiming) {
    const before = this.state.turnSeconds;
    this.state.timing = timing;
    if (this.state.phase === 'lobby') this.applyLobbyTiming();
    else {
      const left = this.state.totalRounds - this.state.round + (this.state.phase === 'painting' ? 1 : 0);
      this.applyPartyTiming(Math.max(1, left));
      // The round underway gains or loses the difference (never below 10 s, unless already over).
      if (this.state.phase === 'painting' && !this.state.overtime) {
        this.state.secondsLeft = Math.max(10, this.state.secondsLeft + this.state.turnSeconds - before);
        this.broadcast({ type: 'timer', secondsLeft: this.state.secondsLeft });
      }
    }
    this.broadcastState();
  }

  // ---------- archive ----------

  /** The host chose to keep the gallery: store finished images + strokes (never AV or chat). */
  private async archive(hostId: string) {
    this.state.archive = { ...this.state.archive, saving: true, error: null };
    this.broadcastState();
    try {
      const built = await buildArchive(
        this.state.pieces,
        (canvasId) => {
          const history = this.histories.get(canvasId);
          return history?.complete ? history.strokes : null;
        },
        async (url) => {
          const file = url.match(/^\/snapshots\/[a-z0-9-]{3,40}\/(c\d{1,2}-r\d{1,3}\.png)$/)?.[1];
          return file ? readFile(join(SNAPSHOT_DIR, this.state.partyId, file)).catch(() => null) : null;
        }
      );
      const { id, deleteKey } = await saveArchive(this.state.partyId, this.state.room, built);
      this.state.archive = { ...this.state.archive, saving: false, id };
      this.sendToMember(hostId, { type: 'archiveSaved', id, deleteKey });
    } catch (error) {
      console.error('[archive]', error);
      this.state.archive = { ...this.state.archive, saving: false, error: (error as Error).message.startsWith('This party') ? (error as Error).message : "Couldn't save the gallery. Try again in a moment." };
    }
    this.broadcastState();
  }

  // ---------- sending ----------

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  /** To every connected device of one artist. */
  private sendToMember(memberId: string, msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const device of this.sessions.get(memberId)?.devices.values() ?? []) {
      if (device.ws?.readyState === device.ws?.OPEN) device.ws?.send(data);
    }
  }

  /** To the device holding a duty; if it's offline, to any device of theirs that's here. */
  private sendToDuty(memberId: string, duty: DeviceDuty, msg: ServerMessage) {
    const session = this.sessions.get(memberId);
    if (!session) return;
    const holder = session[duty] ? session.devices.get(session[duty]!) : undefined;
    const ws = holder?.ws ?? [...session.devices.values()].find((d) => d.ws)?.ws;
    if (ws) this.send(ws, msg);
  }

  /** Each of an artist's devices learns the list, and which duties it holds. */
  private sendDevices(memberId: string) {
    const session = this.sessions.get(memberId);
    if (!session) return;
    const devices: MyDevice[] = [...session.devices.values()].map((d) => ({ id: d.id, label: d.label, canvas: session.canvas === d.id, call: session.call === d.id, online: !!d.ws }));
    for (const device of session.devices.values()) {
      if (device.ws) this.send(device.ws, { type: 'devices', youDeviceId: device.id, devices });
    }
  }

  private broadcast(msg: ServerMessage, exceptId?: string) {
    const data = JSON.stringify(msg);
    for (const [id, session] of this.sessions) {
      if (id === exceptId) continue;
      for (const device of session.devices.values()) {
        if (device.ws?.readyState === device.ws?.OPEN) device.ws?.send(data);
      }
    }
  }

  private broadcastState() {
    this.broadcast({ type: 'state', state: this.state });
  }
}
