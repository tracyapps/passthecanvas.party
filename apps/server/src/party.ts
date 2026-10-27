// One Party = one game room. It owns the members, the turn order and the timer.
// The server is the source of truth: browsers ask, the party decides.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import {
  painterForRound,
  type ClientMessage,
  type Member,
  type PartyState,
  type ServerMessage,
  type Stroke
} from '@ptc/shared';

export const SNAPSHOT_DIR = join(process.cwd(), 'data', 'snapshots');
const TURN_SECONDS = Number(process.env.TURN_SECONDS ?? 90);
const MAX_POINTS_PER_BATCH = 2000;
const MAX_SNAPSHOT_CHARS = 3_500_000; // about 2.5 MB of PNG

const parties = new Map<string, Party>();

export function getParty(id: string): Party {
  let party = parties.get(id);
  if (!party) {
    party = new Party(id);
    parties.set(id, party);
  }
  return party;
}

class Party {
  private sockets = new Map<string, WebSocket>(); // memberId → socket
  private ticker: ReturnType<typeof setInterval> | null = null;
  private state: PartyState;

  constructor(id: string) {
    this.state = {
      partyId: id,
      members: [],
      order: [],
      phase: 'lobby',
      round: 1,
      totalRounds: 0,
      painterId: null,
      secondsLeft: TURN_SECONDS,
      turnSeconds: TURN_SECONDS,
      snapshotUrl: null,
      radio: null
    };
  }

  /** A browser connected. It becomes a member once it sends `join`. */
  connect(ws: WebSocket) {
    let memberId: string | null = null;

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return this.send(ws, { type: 'error', message: 'Bad message' });
      }

      if (msg.type === 'join') {
        if (memberId) return; // already joined
        memberId = this.addMember(ws, msg.name, msg.presence);
        return;
      }
      if (!memberId) return this.send(ws, { type: 'error', message: 'Join first' });
      this.handle(memberId, msg);
    });

    ws.on('close', () => {
      if (memberId) this.removeMember(memberId);
    });
  }

  // ---------- members ----------

  private addMember(ws: WebSocket, rawName: string, presence: Member['presence']): string {
    const id = randomUUID();
    const name = String(rawName ?? '').trim().slice(0, 40) || 'Guest';
    const isHost = this.state.members.length === 0; // first one in hosts
    this.state.members.push({ id, name, presence: presence === 'avatar' ? 'avatar' : 'camera', isHost, spotId: null });
    this.state.order.push(id);
    this.sockets.set(id, ws);

    this.send(ws, { type: 'welcome', youId: id, state: this.state });
    this.broadcastState();
    return id;
  }

  private removeMember(id: string) {
    const wasPainter = this.state.painterId === id;
    this.sockets.delete(id);
    this.state.members = this.state.members.filter((m) => m.id !== id);
    this.state.order = this.state.order.filter((m) => m !== id);

    // Hand the host role on if the host left.
    const first = this.state.members[0];
    if (first && !this.state.members.some((m) => m.isHost)) first.isHost = true;

    if (this.state.members.length === 0) {
      this.stopTimer();
      parties.delete(this.state.partyId);
      return;
    }
    if (wasPainter && this.state.phase === 'painting') this.nextTurn();
    else this.broadcastState();
  }

  private member(id: string) {
    return this.state.members.find((m) => m.id === id);
  }

  // ---------- messages ----------

  private handle(fromId: string, msg: ClientMessage) {
    const from = this.member(fromId);
    if (!from) return;

    switch (msg.type) {
      case 'start': {
        if (!from.isHost || this.state.phase !== 'lobby') return;
        this.state.totalRounds = this.state.order.length;
        this.state.round = 1;
        this.startTurn();
        return;
      }

      case 'stroke': {
        // Only the current painter may paint. Everyone else's strokes are dropped.
        if (this.state.phase !== 'painting' || fromId !== this.state.painterId) return;
        const stroke = sanitizeStroke(msg.stroke);
        if (!stroke) return;
        this.broadcast({ type: 'stroke', stroke, painterId: fromId }, fromId);
        return;
      }

      case 'passNow': {
        if (this.state.phase !== 'painting') return;
        if (fromId !== this.state.painterId && !from.isHost) return;
        this.endTurn();
        return;
      }

      case 'snapshot': {
        // Only the painter of this round sends its snapshot.
        if (fromId !== this.state.painterId || msg.round !== this.state.round) return;
        void this.saveSnapshot(msg.round, msg.pngDataUrl);
        return;
      }

      case 'takeSpot': {
        const taken = this.state.members.some((m) => m.spotId === msg.spotId && m.id !== fromId);
        if (taken || typeof msg.spotId !== 'string' || msg.spotId.length > 60) return;
        from.spotId = msg.spotId;
        this.broadcastState();
        return;
      }

      case 'chat': {
        const text = String(msg.text ?? '').trim().slice(0, 500);
        if (!text) return;
        this.broadcast({ type: 'chat', fromId, name: from.name, text, at: Date.now() });
        return;
      }

      case 'setRadio': {
        if (!from.isHost) return;
        if (!/^https:\/\//.test(msg.streamUrl)) return; // https streams only
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

  // ---------- turns + timer ----------

  private startTurn() {
    this.state.phase = 'painting';
    this.state.painterId = painterForRound(this.state.order, this.state.round);
    this.state.secondsLeft = this.state.turnSeconds;
    this.broadcastState();
    this.startTimer();
  }

  private startTimer() {
    this.stopTimer();
    this.ticker = setInterval(() => {
      this.state.secondsLeft -= 1;
      this.broadcast({ type: 'timer', secondsLeft: this.state.secondsLeft });
      if (this.state.secondsLeft <= 0) this.endTurn();
    }, 1000);
  }

  private stopTimer() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }

  /** Time's up (or passed early): ask the painter for a snapshot, then move on. */
  private endTurn() {
    this.stopTimer();
    this.state.phase = 'passing';
    const painterSocket = this.state.painterId ? this.sockets.get(this.state.painterId) : undefined;
    if (painterSocket) this.send(painterSocket, { type: 'requestSnapshot', round: this.state.round });
    this.broadcastState();

    // Give everyone a moment to see the "pass the canvas" card.
    setTimeout(() => this.nextTurn(), 4000);
  }

  private nextTurn() {
    if (this.state.round >= this.state.totalRounds) {
      this.state.phase = 'reveal';
      this.state.painterId = null;
      this.stopTimer();
      this.broadcastState();
      return;
    }
    this.state.round += 1;
    this.startTurn();
  }

  private async saveSnapshot(round: number, dataUrl: string) {
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_SNAPSHOT_CHARS) return;
    const prefix = 'data:image/png;base64,';
    if (!dataUrl.startsWith(prefix) || !Number.isInteger(round) || round < 1 || round > 999) return;

    const dir = join(SNAPSHOT_DIR, this.state.partyId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `round-${round}.png`), Buffer.from(dataUrl.slice(prefix.length), 'base64'));
    this.state.snapshotUrl = `/snapshots/${this.state.partyId}/round-${round}.png`;
    this.broadcastState();
  }

  // ---------- sending ----------

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, exceptId?: string) {
    const data = JSON.stringify(msg);
    for (const [id, ws] of this.sockets) {
      if (id !== exceptId && ws.readyState === ws.OPEN) ws.send(data);
    }
  }

  private broadcastState() {
    this.broadcast({ type: 'state', state: this.state });
  }
}

/** Clamp a stroke from the network to sane values; return null if it's junk. */
function sanitizeStroke(input: Stroke): Stroke | null {
  if (!input || !Array.isArray(input.points) || input.points.length > MAX_POINTS_PER_BATCH) return null;
  const tools = ['pencil', 'round', 'flat', 'wash', 'eraser'];
  if (!tools.includes(input.tool)) return null;
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return null;
  const clamp = (n: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0));
  return {
    id: String(input.id).slice(0, 64),
    tool: input.tool,
    color: input.color,
    size: clamp(input.size, 1, 120),
    flow: clamp(input.flow, 0.05, 1),
    done: Boolean(input.done),
    points: input.points.map((p) => ({
      x: clamp(p.x, -50, 1650),
      y: clamp(p.y, -50, 1250),
      pressure: clamp(p.pressure, 0, 1)
    }))
  };
}
