// The browser side of the party server connection.
// Svelte "runes" ($state) make these fields reactive: components that read
// them update automatically when messages arrive.

import { partySocketUrl } from './origin';
import { deviceLabel, type ClientMessage, type DeviceDuty, type LinkRole, type Look, type MyDevice, type PaintedStroke, type PartyState, type Piece, type Presence, type ServerMessage } from '@ptc/shared';

/** This tab's seat in a party: enough to rejoin after a dropped connection or a reload. */
interface SavedSeat {
  memberId: string;
  deviceId: string;
  key: string;
}

// sessionStorage, not localStorage: the seat belongs to this tab only, and is
// gone when the tab closes. It can throw (private modes); then there's no rejoin.
const seatKey = (partyId: string) => `ptc-seat:${partyId}`;
export function savedSeat(partyId: string): SavedSeat | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(seatKey(partyId)) ?? 'null');
    return raw && typeof raw.memberId === 'string' && typeof raw.deviceId === 'string' && typeof raw.key === 'string' ? raw : null;
  } catch {
    return null;
  }
}
function saveSeat(partyId: string, seat: SavedSeat | null) {
  try {
    if (seat) sessionStorage.setItem(seatKey(partyId), JSON.stringify(seat));
    else sessionStorage.removeItem(seatKey(partyId));
  } catch {
    // No storage: the party still works, it just can't survive a reload.
  }
}

/** "iPad", "Mac"… plus "(window)" for a second window on the same computer. */
function thisDevice(): string {
  const label = deviceLabel(navigator.userAgent, navigator.maxTouchPoints);
  return new URLSearchParams(location.hash.slice(1)).get('window') ? `${label} (window)` : label;
}

/** Everything painted on one canvas so far, as the server sent it. */
export interface CanvasHistory {
  canvasId: string;
  strokes: PaintedStroke[];
  complete: boolean;
  baseUrl: string | null;
}

export class PartyConnection {
  state = $state<PartyState | null>(null);
  youId = $state<string | null>(null);
  connected = $state(false);
  chat = $state<{ fromId: string; name: string; text: string; at: number }[]>([]);
  /** Notes that arrived while the notepad was closed. */
  unreadChat = $state(0);
  /** Set by the studio: is the notepad open right now? */
  chatOpen = false;
  /** Short message for the screen-reader live region. */
  announcement = $state('');
  /**
   * The latest canvas history per canvas id. $state.raw: these are big
   * arrays that are replaced whole, never edited, so no deep tracking.
   */
  histories = $state.raw<Record<string, CanvasHistory>>({});
  /** Everyone's avatar pictures, by member id (sent apart from the state to keep it small). */
  looks = $state.raw<Record<string, string>>({});
  /** The host's private delete key for the saved gallery (never sent to anyone else). */
  archiveDeleteKey = $state<string | null>(null);

  /** Your devices, and which one holds the canvas and the call (see MyDevice). */
  devices = $state<MyDevice[]>([]);
  youDeviceId = $state<string | null>(null);
  /** Your one-time link code for another device, while it's open. */
  link = $state<{ code: string; role: LinkRole; expiresAt: number } | null>(null);
  /** The connection dropped and we're trying again. */
  reconnecting = $state(false);
  /** The server refused this tab (a closed seat, a bad code, unlinked). Shown on the join screen. */
  refused = $state<string | null>(null);

  private socket: WebSocket | null = null;
  private partyId: string | null = null;
  private leftOnPurpose = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set by the studio: another of your devices asked to pass; finish the stroke and pass. */
  onPassRequest: () => void = () => {};

  /** Set by the studio: strokes on the canvas you're looking at. */
  onStroke: (stroke: PaintedStroke) => void = () => {};
  /** Set by the studio to answer the server's snapshot request. */
  onSnapshotRequest: (round: number, canvasId: string) => void = () => {};

  join(partyId: string, name: string, presence: Presence, look?: Look) {
    this.open(partyId, { type: 'join', name, presence, look, device: thisDevice() });
  }

  /** Back to this tab's seat after a reload. False when there's no seat to go back to. */
  rejoin(partyId: string): boolean {
    const seat = savedSeat(partyId);
    if (!seat) return false;
    this.open(partyId, { type: 'rejoin', ...seat });
    return true;
  }

  /** Join as one of your devices, with a code made on another one. */
  redeem(partyId: string, code: string) {
    this.open(partyId, { type: 'redeemLink', code, device: thisDevice() });
  }

  private open(partyId: string, hello: ClientMessage) {
    this.partyId = partyId;
    this.leftOnPurpose = false;
    this.refused = null;
    const socket = new WebSocket(partySocketUrl(partyId));
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.connected = true;
      this.send(hello);
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.connected = false;
      this.scheduleReconnect();
    });
    socket.addEventListener('message', (event) => this.receive(JSON.parse(event.data)));
  }

  /**
   * Phones sleep, wifi blinks. Unless you left (or the server refused this
   * tab), try again with this tab's seat: 1 s, 2 s, 4 s… up to 15 s.
   */
  private scheduleReconnect() {
    if (this.leftOnPurpose || this.refused || !this.partyId || !this.youId) return;
    const seat = savedSeat(this.partyId);
    if (!seat) return;
    this.reconnecting = true;
    if (this.retries === 0) this.announcement = 'Connection lost. Reconnecting… your seat is saved.';
    const delay = Math.min(15_000, 1000 * 2 ** this.retries);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      if (this.partyId) this.open(this.partyId, { type: 'rejoin', ...seat });
    }, delay);
  }

  /** Leave the party: tell the server (so your seat frees up now), close and forget everything. */
  leave() {
    this.send({ type: 'leave' });
    this.leftOnPurpose = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.partyId) saveSeat(this.partyId, null);
    this.socket?.close();
    this.socket = null;
    this.forget();
  }

  private forget() {
    this.connected = false;
    this.reconnecting = false;
    this.state = null;
    this.youId = null;
    this.chat = [];
    this.histories = {};
    this.looks = {};
    this.devices = [];
    this.youDeviceId = null;
    this.link = null;
  }

  /** Does this device hold a duty? Before the device list arrives, yes (a single device holds both). */
  holds(duty: DeviceDuty): boolean {
    const mine = this.devices.find((d) => d.id === this.youDeviceId);
    return mine ? mine[duty] : true;
  }

  /** Your other devices (and windows). */
  get otherDevices(): MyDevice[] {
    return this.devices.filter((d) => d.id !== this.youDeviceId);
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  get me() {
    return this.state?.members.find((m) => m.id === this.youId) ?? null;
  }

  /** The canvas in front of you this round (null in the lobby, the reveal, or when watching). */
  get myCanvasId(): string | null {
    return (this.youId && this.state?.assignments[this.youId]) || null;
  }

  piece(canvasId: string | null): Piece | null {
    return this.state?.pieces.find((p) => p.id === canvasId) ?? null;
  }

  /** Your own canvas (the one you started). */
  get myPiece(): Piece | null {
    return this.state?.pieces.find((p) => p.ownerId === this.youId) ?? null;
  }

  /** Painting right now: a canvas in front of you, and you haven't passed it yet. */
  get isPainting() {
    return this.state?.phase === 'painting' && !!this.myCanvasId && !this.state.passed.includes(this.youId ?? '');
  }

  /** Still painting this round (for "waiting for 2 others"). */
  get stillPainting(): string[] {
    const state = this.state;
    if (!state || state.phase !== 'painting') return [];
    return Object.keys(state.assignments).filter((id) => !state.passed.includes(id) && state.members.some((m) => m.id === id));
  }

  nameOf(id: string | null) {
    return this.state?.members.find((m) => m.id === id)?.name ?? 'A guest';
  }

  private receive(message: ServerMessage) {
    switch (message.type) {
      case 'welcome':
        this.youId = message.youId;
        this.state = message.state;
        if (this.partyId) saveSeat(this.partyId, { memberId: message.youId, ...message.session });
        if (this.reconnecting) this.announcement = 'Reconnected.';
        this.reconnecting = false;
        this.retries = 0;
        break;
      case 'devices':
        this.devices = message.devices;
        this.youDeviceId = message.youDeviceId;
        break;
      case 'linkCode':
        this.link = message.link;
        break;
      case 'passRequest':
        this.onPassRequest();
        break;
      case 'rejected':
        this.refused = message.message;
        this.reconnecting = false;
        if (this.partyId && message.reason !== 'full') saveSeat(this.partyId, null);
        this.announcement = message.message;
        this.socket?.close();
        this.socket = null;
        this.forget();
        break;
      case 'state': {
        const before = this.state;
        this.state = message.state;
        this.announceChanges(before, message.state);
        break;
      }
      case 'timer':
        if (this.state) this.state.secondsLeft = message.secondsLeft;
        if (message.secondsLeft === 30) this.announcement = '30 seconds left';
        if (message.secondsLeft === 10) this.announcement = '10 seconds left';
        break;
      case 'canvasHistory':
        this.histories = { ...this.histories, [message.canvasId]: { canvasId: message.canvasId, strokes: message.strokes, complete: message.complete, baseUrl: message.baseUrl } };
        break;
      case 'stroke':
        this.onStroke(message.stroke);
        break;
      case 'requestSnapshot':
        this.onSnapshotRequest(message.round, message.canvasId);
        break;
      case 'chat':
        // Keep the notepad to the last 200 notes; it is a party, not an archive.
        this.chat = [...this.chat, { fromId: message.fromId, name: message.name, text: message.text, at: message.at }].slice(-200);
        if (!this.chatOpen && message.fromId !== this.youId) {
          this.unreadChat += 1;
          this.announcement = `New note from ${message.name}.`;
        }
        break;
      case 'looks':
        this.looks = message.looks;
        break;
      case 'look': {
        const next = { ...this.looks };
        if (message.image) next[message.memberId] = message.image;
        else delete next[message.memberId];
        this.looks = next;
        break;
      }
      case 'archiveSaved':
        this.archiveDeleteKey = message.deleteKey;
        break;
      case 'error':
        console.warn('[party]', message.message);
        break;
    }
  }

  /** Round changes are announced once, not every second. */
  private announceChanges(before: PartyState | null, after: PartyState) {
    const mine = this.youId ? after.assignments[this.youId] : undefined;
    const piece = after.pieces.find((p) => p.id === mine);
    const whose = piece ? (piece.ownerId === this.youId ? 'your own canvas' : `${piece.ownerName}'s canvas`) : '';
    if (after.radio?.playing && (before?.radio?.streamUrl !== after.radio.streamUrl || !before?.radio?.playing)) {
      this.announcement = `Party radio: ${after.radio.stationName}. Open Radio to mute it or change your volume.`;
    } else if (before?.radio?.playing && !after.radio?.playing) {
      this.announcement = 'The party radio is off.';
    } else if (!before?.overtime && after.overtime && after.phase === 'painting') {
      this.announcement = mine ? "Time's up. Finish your stroke, then pass the canvas." : "Time's up. The painters are finishing.";
    } else if (before?.phase !== after.phase && after.phase === 'passing') {
      this.announcement = 'Passing the canvases.';
    } else if ((before?.phase !== 'painting' || before.round !== after.round) && after.phase === 'painting') {
      this.announcement = `Round ${after.round} of ${after.totalRounds}. ${whose ? `You have ${whose}.` : 'You are watching.'}`;
    } else if (!before?.archive?.id && after.archive?.id) {
      this.announcement = 'The host saved a shareable gallery of these pieces. Anyone with its link can see them and your name.';
    } else if (before?.phase !== after.phase && after.phase === 'reveal') {
      this.announcement = 'All rounds done. Time for the reveal.';
    }
  }
}
