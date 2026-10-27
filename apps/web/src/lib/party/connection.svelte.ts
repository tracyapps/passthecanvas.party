// The browser side of the party server connection.
// Svelte "runes" ($state) make these fields reactive: components that read
// them update automatically when messages arrive.

import type { ClientMessage, PartyState, Presence, ServerMessage, Stroke } from '@ptc/shared';

export class PartyConnection {
  state = $state<PartyState | null>(null);
  youId = $state<string | null>(null);
  connected = $state(false);
  chat = $state<{ name: string; text: string; at: number }[]>([]);
  /** Short message for the screen-reader live region. */
  announcement = $state('');

  private socket: WebSocket | null = null;

  /** Set by the studio screen so remote strokes reach the canvas. */
  onRemoteStroke: (stroke: Stroke) => void = () => {};
  /** Set by the studio screen to answer the server's snapshot request. */
  onSnapshotRequest: (round: number) => void = () => {};

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
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  get me() {
    return this.state?.members.find((m) => m.id === this.youId) ?? null;
  }

  get painter() {
    return this.state?.members.find((m) => m.id === this.state?.painterId) ?? null;
  }

  get isMyTurn() {
    return this.state?.phase === 'painting' && this.state.painterId === this.youId;
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
      case 'stroke':
        this.onRemoteStroke(message.stroke);
        break;
      case 'requestSnapshot':
        this.onSnapshotRequest(message.round);
        break;
      case 'chat':
        this.chat.push({ name: message.name, text: message.text, at: message.at });
        break;
      case 'error':
        console.warn('[party]', message.message);
        break;
    }
  }

  /** Turn changes are announced once, not every second. */
  private announceChanges(before: PartyState | null, after: PartyState) {
    if (before?.phase !== after.phase && after.phase === 'passing') {
      this.announcement = 'Time is up. Pass the canvas.';
    } else if (before?.painterId !== after.painterId && after.painterId) {
      this.announcement = after.painterId === this.youId ? 'Your turn to paint.' : `${this.painter?.name ?? 'Someone'} is painting now.`;
    } else if (before?.phase !== after.phase && after.phase === 'reveal') {
      this.announcement = 'All rounds done. Time for the reveal.';
    }
  }
}
