// The browser side of the party server connection.
// Svelte "runes" ($state) make these fields reactive: components that read
// them update automatically when messages arrive.

import type { ClientMessage, PaintedStroke, PartyState, Piece, Presence, ServerMessage } from '@ptc/shared';

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

  private socket: WebSocket | null = null;

  /** Set by the studio: strokes on the canvas you're looking at. */
  onStroke: (stroke: PaintedStroke) => void = () => {};
  /** Set by the studio to answer the server's snapshot request. */
  onSnapshotRequest: (round: number, canvasId: string) => void = () => {};

  join(partyId: string, name: string, presence: Presence) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.socket = new WebSocket(`${protocol}://${location.host}/party/${partyId}`);
    this.socket.addEventListener('open', () => {
      this.connected = true;
      this.send({ type: 'join', name, presence });
    });
    this.socket.addEventListener('close', () => (this.connected = false));
    this.socket.addEventListener('message', (event) => this.receive(JSON.parse(event.data)));
  }

  /** Leave the party: close the socket and forget everything. */
  leave() {
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.state = null;
    this.youId = null;
    this.chat = [];
    this.histories = {};
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
    } else if (before?.phase !== after.phase && after.phase === 'reveal') {
      this.announcement = 'All rounds done. Time for the reveal.';
    }
  }
}
