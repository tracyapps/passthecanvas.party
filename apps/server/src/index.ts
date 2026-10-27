// Party server entry point.
// - GET  /health                      → "ok"
// - GET  /api/token?party=…&name=…    → LiveKit access token for the video call
// - GET  /snapshots/:party/:file      → saved round images
// - WS   /party/:partyId              → the game (see packages/shared/src/protocol.ts)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { getParty, SNAPSHOT_DIR } from './party.ts';
import { makeLiveKitToken } from './livekit.ts';

const PORT = Number(process.env.PORT ?? 8787);

// Party ids and file names are restricted to safe characters so nobody can
// reach files outside the snapshot folder.
const SAFE_ID = /^[a-z0-9-]{3,40}$/;
const SAFE_FILE = /^round-\d{1,3}\.png$/;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    res.end('ok');
    return;
  }

  if (url.pathname === '/api/token') {
    const party = url.searchParams.get('party') ?? '';
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 40);
    if (!SAFE_ID.test(party) || name === '') {
      res.writeHead(400).end('party and name are required');
      return;
    }
    try {
      const token = await makeLiveKitToken(party, name);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token, url: process.env.LIVEKIT_URL }));
    } catch (error) {
      console.error('[token]', error);
      res.writeHead(503).end('video is not configured yet');
    }
    return;
  }

  const snap = url.pathname.match(/^\/snapshots\/([^/]+)\/([^/]+)$/);
  if (snap && SAFE_ID.test(snap[1]!) && SAFE_FILE.test(snap[2]!)) {
    try {
      const file = await readFile(join(SNAPSHOT_DIR, snap[1]!, snap[2]!));
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache' });
      res.end(file);
    } catch {
      res.writeHead(404).end();
    }
    return;
  }

  res.writeHead(404).end();
});

// WebSocket upgrades only on /party/:id
const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = url.pathname.match(/^\/party\/([^/]+)$/);
  const partyId = match?.[1];
  if (!partyId || !SAFE_ID.test(partyId)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    getParty(partyId).connect(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Party server on http://localhost:${PORT}`);
});
