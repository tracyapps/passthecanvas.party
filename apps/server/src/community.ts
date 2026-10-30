import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { verifyToken } from '@clerk/backend';
import pg from 'pg';
import { activeSessionUser } from './accounts.ts';
import { CommunityError, postgresCommunityStore, type CommunityStore } from './community-store.ts';
import type { ScheduleInput, StudioProfile } from '@ptc/shared';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
interface Dependencies { configured: boolean; origins: string[]; authenticate(token: string): Promise<string>; store(): Promise<CommunityStore> }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, names: string[]): boolean { return Object.keys(value).every(key => names.includes(key)); }
function text(value: unknown, min: number, max: number, multiline = false): value is string { return typeof value === 'string' && value.trim().length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(multiline ? value.replace(/[\r\n]/g, '') : value); }
export function validProfile(value: unknown): value is Omit<StudioProfile, 'id'> {
  return object(value) && keys(value, ['name', 'bio', 'avatar', 'share', 'allowRequests', 'emailInvites', 'emailReminders']) && text(value.name, 1, 40) && text(value.bio, 0, 280, true) && typeof value.share === 'boolean' && typeof value.allowRequests === 'boolean' && typeof value.emailInvites === 'boolean' && typeof value.emailReminders === 'boolean' && object(value.avatar) && keys(value.avatar, ['mark', 'color']) && ['brush', 'star', 'cat', 'swirl'].includes(String(value.avatar.mark)) && ['magenta', 'teal', 'violet', 'gold'].includes(String(value.avatar.color));
}
export function validSchedule(value: unknown, now = Date.now()): value is ScheduleInput {
  if (!object(value) || !keys(value, ['title', 'startsAt', 'timeZone', 'durationMinutes']) || !text(value.title, 1, 80) || typeof value.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.startsAt) || !text(value.timeZone, 1, 80)) return false;
  const time = Date.parse(value.startsAt);
  if (!Number.isFinite(time) || time < now + 60_000 || time > now + 366 * 86400_000 || !Number.isInteger(value.durationMinutes) || Number(value.durationMinutes) < 15 || Number(value.durationMinutes) > 240) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { return false; }
  return true;
}
function send(res: ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new CommunityError(415, 'Send JSON.');
  let length = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk);
    if (length > 8192) throw new CommunityError(413, 'This request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  let result: unknown;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new CommunityError(400, 'Invalid JSON.'); }
  if (!object(result)) throw new CommunityError(400, 'Invalid request.');
  return result;
}
export function createCommunityHandler(deps: Dependencies) {
  // Bound authenticated writes per process; database uniqueness also prevents duplicates.
  const recent = new Map<string, { until: number; count: number }>();
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Vary', 'Origin');
    res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    if (origin && !deps.origins.includes(origin)) return send(res, 403, { error: 'This origin is not allowed.' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.writeHead(204).end(); return;
    }
    if (!['GET', 'PUT', 'POST'].includes(req.method ?? '')) return send(res, 405, { error: 'Method not allowed.' });
    if (!deps.configured) return send(res, 503, { error: 'Accounts need Clerk and the account database connected.' });
    let user: string;
    try {
      const token = req.headers.authorization;
      if (!token?.startsWith('Bearer ')) throw new Error();
      user = await deps.authenticate(token.slice(7)); if (!user) throw new Error();
    } catch { return send(res, 401, { error: 'Sign in to open your studio.' }); }
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const route = url.pathname.replace('/api/account/community', '');
      const db = await deps.store();
      if (req.method === 'GET') {
        if (route === '') return send(res, 200, await db.home(user));
        if (route === '/profile' && ID.test(url.searchParams.get('id') ?? '')) return send(res, 200, await db.profile(user, url.searchParams.get('id')!));
        if (route === '/invitation' && TOKEN.test(url.searchParams.get('token') ?? '')) return send(res, 200, await db.sharedParty(url.searchParams.get('token')!));
        throw new CommunityError(404, 'This item is unavailable.');
      }
      const now = Date.now();
      if (recent.size > 10000) for (const [key, item] of recent) if (item.until < now) recent.delete(key);
      const limit = recent.get(user);
      if (limit && limit.until > now && limit.count >= 30) throw new CommunityError(429, 'Please wait a minute before trying again.');
      recent.set(user, limit && limit.until > now ? { ...limit, count: limit.count + 1 } : { count: 1, until: now + 60_000 });
      const value = await body(req);
      if (route === '/profile' && req.method === 'PUT' && validProfile(value)) { await db.saveProfile(user, { ...value, name: value.name.trim(), bio: value.bio.trim() }); return send(res, 200, { saved: true }); }
      if (req.method !== 'POST') throw new CommunityError(400, 'This request could not be used.');
      if (route === '/friends' && keys(value, ['target']) && ID.test(String(value.target))) await db.requestFriend(user, String(value.target));
      else if (route === '/friends/respond' && keys(value, ['target', 'action']) && ID.test(String(value.target)) && ['accept', 'decline', 'remove'].includes(String(value.action))) await db.respondFriend(user, String(value.target), value.action as 'accept' | 'decline' | 'remove');
      else if (route === '/parties' && validSchedule(value)) return send(res, 201, await db.schedule(user, value));
      else if (route === '/parties/invite' && keys(value, ['party', 'friend']) && ID.test(String(value.party)) && ID.test(String(value.friend))) await db.invite(user, String(value.party), String(value.friend));
      else if (route === '/parties/respond' && keys(value, ['party', 'response']) && ID.test(String(value.party)) && ['yes', 'no'].includes(String(value.response))) await db.respondParty(user, String(value.party), value.response as 'yes' | 'no');
      else if (route === '/parties/join' && keys(value, ['token']) && TOKEN.test(String(value.token))) await db.joinShared(user, String(value.token));
      else if (route === '/parties/cancel' && keys(value, ['party']) && ID.test(String(value.party))) await db.cancel(user, String(value.party));
      else if (route === '/parties/link' && keys(value, ['party']) && ID.test(String(value.party))) return send(res, 200, await db.rotateLink(user, String(value.party)));
      else throw new CommunityError(400, 'Check the details and try again.');
      send(res, 200, { saved: true });
    } catch (error) {
      if (error instanceof CommunityError) return send(res, error.status, { error: error.message });
      send(res, 503, { error: 'Your studio could not be loaded or saved. Please try again.' });
    }
  };
}
export async function initializeCommunitySchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ptc-community-schema-v1'))");
    await client.query(await readFile(new URL('./community-schema.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export function configuredCommunityHandler() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? '';
  const origins = (process.env.ACCOUNT_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const configured = !!(secretKey && process.env.DATABASE_URL && origins.length);
  const pool = configured ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, query_timeout: 5000 }) : null;
  let initialized: Promise<void> | null = null;
  return createCommunityHandler({ configured, origins,
    async authenticate(token) { return activeSessionUser(await verifyToken(token, { secretKey, authorizedParties: origins })); },
    async store() {
      if (!pool) throw new Error('Not configured');
      initialized ??= initializeCommunitySchema(pool).catch(error => { initialized = null; throw error; });
      await initialized; return postgresCommunityStore(pool);
    }
  });
}
