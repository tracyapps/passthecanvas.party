// Party server entry point.
// - GET  /health                      → "ok"
// - GET  /api/token?party=…&name=…    → LiveKit access token for the video call
// - GET  /snapshots/:party/:file      → saved round images
// - GET  /api/link/:code              → which party a device-link code belongs to
// - WS   /party/:partyId              → the game (see packages/shared/src/protocol.ts)

import { createServer } from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { sanitizeArt, sanitizeGeometry, sanitizeSpots, spotsForView } from '@ptc/shared';
import { getParty, SNAPSHOT_DIR } from './party.ts';
import { allowAttempt, peekLink } from './links.ts';
import { normalizeLinkCode } from '@ptc/shared';
import { archiveHandler } from './archive.ts';
import { makeLiveKitToken } from './livekit.ts';
import { configuredAccountHandler } from './accounts.ts';
import { calendarFeedHandler, configuredCommunityHandler } from './community.ts';
import { configuredAccountMail } from './account-mail.ts';

const PORT = Number(process.env.PORT ?? 8787);
const STUDIO_DIR = fileURLToPath(new URL('../../web/public/studio', import.meta.url));

// Party ids and file names are restricted to safe characters so nobody can
// reach files outside the snapshot folder.
const SAFE_ID = /^[a-z0-9-]{3,40}$/;
const SAFE_FILE = /^c\d{1,2}-r\d{1,3}\.png$/;
// The website (Vercel) and this server (Railway) live on different origins.
// Party sockets, video tokens and archive deletes only accept these origins;
// with none set (local dev, same origin through Vite's proxy) anything goes.
const PARTY_ORIGINS = (process.env.PARTY_ALLOWED_ORIGINS ?? process.env.ACCOUNT_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const originAllowed = (origin: string | undefined) => !PARTY_ORIGINS.length || !origin || PARTY_ORIGINS.includes(origin);
const accountHandler = configuredAccountHandler();
const communityHandler = configuredCommunityHandler();
configuredAccountMail();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/account/community' || url.pathname.startsWith('/api/account/community/')) {
    await communityHandler(req, res);
    return;
  }

  if (url.pathname.startsWith('/api/calendar/')) {
    await calendarFeedHandler(req, res);
    return;
  }

  if (url.pathname === '/api/account/workspaces') {
    await accountHandler(req, res);
    return;
  }

  if (url.pathname === '/health') {
    res.end('ok');
    return;
  }

  if (url.pathname.startsWith('/api/archive/')) {
    await archiveHandler(req, res, url.pathname, PARTY_ORIGINS);
    return;
  }

  // A typed link code → its party, so the new device can open it. The code
  // itself is only used up when the device joins over the party socket.
  if (url.pathname.startsWith('/api/link/')) {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('cache-control', 'no-store');
    if (!allowAttempt(`lookup:${clientAddress(req)}`)) {
      res.writeHead(429).end('too many tries');
      return;
    }
    const ticket = peekLink(normalizeLinkCode(decodeURIComponent(url.pathname.slice('/api/link/'.length))));
    if (!ticket) {
      res.writeHead(404).end('no such code');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ party: ticket.partyId }));
    return;
  }

  if (url.pathname === '/api/token') {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
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

  // Save a room's 3D seat map (seats/geometry.json) from the room tool
  // (?seats=<room>), then rewrite every seat view's spots.json from it, so a
  // seat moved once moves in every view. Same SPOTS_EDITOR gate as above.
  if (req.method === 'PUT' && url.pathname.startsWith('/api/seats/')) {
    if (process.env.SPOTS_EDITOR === '0') {
      res.writeHead(403).end('seat editor is disabled');
      return;
    }
    const room = url.pathname.split('/')[3] ?? '';
    const body = await readBody(req, 256 * 1024);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400).end('bad JSON');
      return;
    }
    const geometry = sanitizeGeometry(parsed);
    if (!geometry || geometry.room !== room) {
      res.writeHead(400).end('seat map failed validation');
      return;
    }
    const spotsFile = sanitizeSpots(JSON.parse(await readFile(join(STUDIO_DIR, room, 'spots.json'), 'utf8').catch(() => 'null')));
    if (!spotsFile) {
      res.writeHead(400).end('this room has no spots.json yet');
      return;
    }
    const seatsDir = join(STUDIO_DIR, room, 'seats');
    await writeAtomic(join(seatsDir, 'geometry.json'), geometry);
    // View ids passed SAFE_ID in sanitizeGeometry, so they are safe folder names.
    const written: string[] = [];
    for (const viewId of Object.keys(geometry.views)) {
      await writeAtomic(join(seatsDir, viewId, 'spots.json'), { room, spots: spotsForView(geometry, viewId, spotsFile.spots) });
      written.push(viewId);
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ saved: written.length }));
    return;
  }

  const snap = url.pathname.match(/^\/snapshots\/([^/]+)\/([^/]+)$/);
  if (snap && SAFE_ID.test(snap[1]!) && SAFE_FILE.test(snap[2]!)) {
    try {
      const file = await readFile(join(SNAPSHOT_DIR, snap[1]!, snap[2]!));
      // Public like the party link; CORS so the website can draw it onto a canvas.
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' });
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
  if (!partyId || !SAFE_ID.test(partyId) || !originAllowed(req.headers.origin)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    getParty(partyId).connect(ws, clientAddress(req));
  });
});

server.listen(PORT, () => {
  console.log(`Party server on http://localhost:${PORT}`);
});

/** The caller's address, for slowing down code guessing. Railway sets x-forwarded-for. */
function clientAddress(req: import('node:http').IncomingMessage): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return forwarded || req.socket.remoteAddress || '';
}

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

/** Write JSON via a temp file + rename, so readers never see half a file. */
async function writeAtomic(target: string, data: unknown) {
  await mkdir(dirname(target), { recursive: true });
  const staging = `${target}.tmp`;
  await writeFile(staging, JSON.stringify(data, null, 2) + '\n');
  await rename(staging, target);
}
