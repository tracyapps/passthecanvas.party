// Party server entry point.
// - GET  /health                      → "ok"
// - GET  /api/token?party=…&name=…    → LiveKit access token for the video call
// - GET  /snapshots/:party/:file      → saved round images
// - WS   /party/:partyId              → the game (see packages/shared/src/protocol.ts)

import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { sanitizeArt, sanitizeSpots } from '@ptc/shared';
import { getParty, SNAPSHOT_DIR } from './party.ts';
import { makeLiveKitToken } from './livekit.ts';

const PORT = Number(process.env.PORT ?? 8787);
const STUDIO_DIR = fileURLToPath(new URL('../../web/public/studio', import.meta.url));

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
    // The browser sends its party member id as the LiveKit identity, so a
    // video tile can be matched to the right guest without extra bookkeeping.
    const identity = url.searchParams.get('identity') ?? '';
    if (!SAFE_ID.test(party) || name === '' || (identity && !SAFE_ID.test(identity))) {
      res.writeHead(400).end('party and name are required');
      return;
    }
    try {
      const token = await makeLiveKitToken(party, name, identity || undefined);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ token, url: process.env.LIVEKIT_URL }));
    } catch (error) {
      console.error('[token]', error);
      res.writeHead(503).end('video is not configured yet');
    }
    return;
  }

  // Save the art file for a room. Dev-time tool for the art editor
  // (?art=<room> in the web app). Same gate as the spots editor: disable
  // with SPOTS_EDITOR=0 before the server ever goes public.
  if (req.method === 'PUT' && url.pathname.startsWith('/api/art/')) {
    if (process.env.SPOTS_EDITOR === '0') {
      res.writeHead(403).end('art editor is disabled');
      return;
    }
    const room = url.pathname.split('/')[3] ?? '';
    const body = await readBody(req, 64 * 1024);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400).end('bad JSON');
      return;
    }
    const clean = sanitizeArt(parsed);
    if (!clean || clean.room !== room) {
      res.writeHead(400).end('art file failed validation');
      return;
    }
    const target = join(STUDIO_DIR, room, 'art.json');
    const staging = `${target}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(staging, JSON.stringify(clean, null, 2) + '\n');
    await rename(staging, target); // atomic: never a half-written art.json
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ saved: target }));
    return;
  }

  // Save the spots file for a room. Dev-time tool for the spots editor
  // (?spots=<room> in the web app). Disable with SPOTS_EDITOR=0 before the
  // server ever goes public.
  if (req.method === 'PUT' && url.pathname.startsWith('/api/spots/')) {
    if (process.env.SPOTS_EDITOR === '0') {
      res.writeHead(403).end('spots editor is disabled');
      return;
    }
    const room = url.pathname.split('/')[3] ?? '';
    const body = await readBody(req, 64 * 1024);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400).end('bad JSON');
      return;
    }
    const clean = sanitizeSpots(parsed);
    // The file's own room name must match the URL, so a save can't write
    // into a different room's folder.
    if (!clean || clean.room !== room) {
      res.writeHead(400).end('spots file failed validation');
      return;
    }
    const target = join(STUDIO_DIR, room, 'spots.json');
    const staging = `${target}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(staging, JSON.stringify(clean, null, 2) + '\n');
    await rename(staging, target); // atomic: never a half-written spots.json
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ saved: target }));
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

/** Read a request body as text, up to `limit` bytes. */
function readBody(req: import('node:http').IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
