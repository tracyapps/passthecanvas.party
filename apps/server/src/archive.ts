// Party archive: a finished party's pieces, kept behind an unguessable link.
//
// What is stored: each canvas's final image, the painters' names and turn
// order, and the strokes (for the time-lapse). Never video, audio or chat.
// Saving is the host's choice at the reveal, and every guest is told.
// Anyone with the link can view; only the private delete link can remove it.
//
// Storage is Railway Postgres (DATABASE_URL): one row per archive plus one
// row per file (PNG or gzipped strokes). Without DATABASE_URL the archive is
// simply unavailable, and the reveal says so instead of pretending to save.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import pg from 'pg';
import type { PaintedStroke, Piece } from '@ptc/shared';

export interface ArchiveFile {
  name: string; // e.g. "c1.png", "c1-r3.png", "c1-strokes.json.gz"
  contentType: 'image/png' | 'application/json';
  gzip: boolean;
  bytes: Buffer;
}

/** The public description of an archive (what GET /api/archive/:id returns). */
export interface ArchiveRecord {
  v: 1;
  id: string;
  room: string;
  createdAt: string;
  pieces: {
    id: string;
    ownerName: string;
    shape: string;
    width: number;
    height: number;
    image: string | null; // file name of the finished picture
    strokes: string | null; // file name of the gzipped strokes (time-lapse)
    turns: { round: number; painterId: string; painterName: string; image: string | null }[];
  }[];
}

export const ARCHIVE_ID = /^[A-Za-z0-9_-]{22}$/; // 128 random bits, base64url
const FILE_NAME = /^c\d{1,2}(-r\d{1,3})?(\.png|-strokes\.json\.gz)$/;
const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

let pool: pg.Pool | null = null;
let ready: Promise<unknown> | null = null;

export function archiveConfigured() {
  return !!process.env.DATABASE_URL;
}

function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, query_timeout: 30000 });
  ready ??= pool.query(`
    CREATE TABLE IF NOT EXISTS party_archives (
      id text PRIMARY KEY,
      party_id text NOT NULL,
      room text NOT NULL,
      record jsonb NOT NULL,
      delete_hash bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS party_archive_files (
      archive_id text NOT NULL REFERENCES party_archives(id) ON DELETE CASCADE,
      name text NOT NULL,
      content_type text NOT NULL,
      gzip boolean NOT NULL DEFAULT false,
      bytes bytea NOT NULL,
      PRIMARY KEY (archive_id, name)
    );`);
  return pool;
}

const hash = (key: string) => createHash('sha256').update(key).digest();

/**
 * Build what a party's archive holds, from its pieces, stroke histories and
 * saved round images. Pure apart from `readImage`, so it can be tested.
 */
export async function buildArchive(
  pieces: Piece[],
  strokesOf: (canvasId: string) => PaintedStroke[] | null,
  readImage: (url: string) => Promise<Buffer | null>
): Promise<{ files: ArchiveFile[]; pieces: ArchiveRecord['pieces'] }> {
  const files: ArchiveFile[] = [];
  const out: ArchiveRecord['pieces'] = [];
  for (const piece of pieces) {
    const strokes = strokesOf(piece.id);
    const turns: ArchiveRecord['pieces'][number]['turns'] = [];
    let finalImage: string | null = null;
    const lastWithImage = [...piece.turns].reverse().find((t) => t.url);
    for (const turn of piece.turns) {
      let image: string | null = null;
      // With full strokes the time-lapse rebuilds every turn, so only the
      // finished picture is kept. Without them, keep each turn's image.
      const keep = turn.url && (turn === lastWithImage || !strokes);
      if (keep) {
        const bytes = await readImage(turn.url!);
        if (bytes) {
          image = turn === lastWithImage ? `${piece.id}.png` : `${piece.id}-r${turn.round}.png`;
          files.push({ name: image, contentType: 'image/png', gzip: false, bytes });
          if (turn === lastWithImage) finalImage = image;
        }
      }
      turns.push({ round: turn.round, painterId: turn.painterId, painterName: turn.painterName, image: turn === lastWithImage ? null : image });
    }
    let strokesFile: string | null = null;
    if (strokes && strokes.length) {
      strokesFile = `${piece.id}-strokes.json.gz`;
      files.push({ name: strokesFile, contentType: 'application/json', gzip: true, bytes: gzipSync(JSON.stringify(strokes)) });
    }
    out.push({ id: piece.id, ownerName: piece.ownerName, shape: piece.shape, width: piece.width, height: piece.height, image: finalImage, strokes: strokesFile, turns });
  }
  return { files, pieces: out };
}

/** Save an archive. Returns its id and the one-time private delete key. */
export async function saveArchive(partyId: string, room: string, built: Awaited<ReturnType<typeof buildArchive>>): Promise<{ id: string; deleteKey: string }> {
  const total = built.files.reduce((sum, f) => sum + f.bytes.length, 0);
  if (total > MAX_ARCHIVE_BYTES) throw new Error('This party is too big to archive.');
  const id = randomBytes(16).toString('base64url');
  const deleteKey = randomBytes(24).toString('base64url');
  const record: ArchiveRecord = { v: 1, id, room, createdAt: new Date().toISOString(), pieces: built.pieces };
  const client = await (await ensureReady()).connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO party_archives (id, party_id, room, record, delete_hash) VALUES ($1, $2, $3, $4, $5)', [id, partyId, room, record, hash(deleteKey)]);
    for (const file of built.files) {
      await client.query('INSERT INTO party_archive_files (archive_id, name, content_type, gzip, bytes) VALUES ($1, $2, $3, $4, $5)', [id, file.name, file.contentType, file.gzip, file.bytes]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return { id, deleteKey };
}

async function ensureReady() {
  const p = db();
  await ready;
  return p;
}

/** HTTP: GET /api/archive/:id, GET /api/archive/:id/files/:name, DELETE /api/archive/:id */
export async function archiveHandler(req: IncomingMessage, res: ServerResponse, path: string, allowedOrigins: string[]) {
  const [, , , id, kind, name] = path.split('/'); // "", api, archive, id, files, name
  const origin = req.headers.origin ?? '';
  // Viewing is public (that's what the link is for); deleting is checked below.
  res.setHeader('Access-Control-Allow-Origin', req.method === 'GET' ? '*' : allowedOrigins.includes(origin) ? origin : 'null');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, DELETE', 'Access-Control-Allow-Headers': 'x-delete-key' }).end();
    return;
  }
  if (!archiveConfigured()) return void res.writeHead(503, { 'content-type': 'text/plain' }).end('The archive is not connected yet.');
  if (!id || !ARCHIVE_ID.test(id)) return void res.writeHead(404).end();
  try {
    const pool = await ensureReady();
    if (req.method === 'GET' && !kind) {
      const row = await pool.query('SELECT record FROM party_archives WHERE id = $1', [id]);
      if (!row.rowCount) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' });
      return void res.end(JSON.stringify(row.rows[0].record));
    }
    if (req.method === 'GET' && kind === 'files' && name && FILE_NAME.test(name)) {
      const row = await pool.query('SELECT content_type, gzip, bytes FROM party_archive_files WHERE archive_id = $1 AND name = $2', [id, name]);
      if (!row.rowCount) return void res.writeHead(404).end();
      const file = row.rows[0] as { content_type: string; gzip: boolean; bytes: Buffer };
      res.writeHead(200, {
        'content-type': file.content_type,
        ...(file.gzip ? { 'content-encoding': 'gzip' } : {}),
        'cache-control': 'public, max-age=31536000, immutable' // files never change; a deleted archive's ids are never reused
      });
      return void res.end(file.bytes);
    }
    if (req.method === 'DELETE' && !kind) {
      if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) return void res.writeHead(403).end();
      const key = String(req.headers['x-delete-key'] ?? '');
      const row = await pool.query('SELECT delete_hash FROM party_archives WHERE id = $1', [id]);
      const stored = row.rows[0]?.delete_hash as Buffer | undefined;
      if (!stored || !key || !timingSafeEqual(stored, hash(key))) return void res.writeHead(403).end('Wrong delete link.');
      await pool.query('DELETE FROM party_archives WHERE id = $1', [id]);
      return void res.writeHead(204).end();
    }
    res.writeHead(405).end();
  } catch (error) {
    console.error('[archive]', error);
    res.writeHead(500).end('The archive had a problem.');
  }
}
