import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { verifyToken } from '@clerk/backend';
import pg from 'pg';
import { activeSessionUser } from './accounts.ts';
import { CommunityError, postgresCommunityStore, type CommunityStore } from './community-store.ts';
import { gunzipSync, gzipSync } from 'node:zlib';
import { CANVAS_SHAPES, calendarFile, cleanPartySettings, sanitizeStroke, type CanvasShape, cleanSocialLink, INITIALS_COLOR_KEYS, MAX_SOCIAL_LINKS, type ProfileInput, type ScheduleInput } from '@ptc/shared';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const FEED_TOKEN = /^[A-Za-z0-9_-]{32}$/;
const ARCHIVE = /^[A-Za-z0-9_-]{22}$/;
const MAX_PHOTO_BYTES = 400_000;
interface Dependencies { configured: boolean; origins: string[]; authenticate(token: string): Promise<string>; store(): Promise<CommunityStore> }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, names: string[]): boolean { return Object.keys(value).every(key => names.includes(key)); }
function text(value: unknown, min: number, max: number, multiline = false): value is string { return typeof value === 'string' && value.trim().length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(multiline ? value.replace(/[\r\n]/g, '') : value); }
export function validProfile(value: unknown): value is ProfileInput {
  return object(value) && keys(value, ['name', 'bio', 'avatar', 'links', 'share', 'allowRequests', 'emailInvites', 'emailReminders']) && text(value.name, 1, 40) && text(value.bio, 0, 280, true) && typeof value.share === 'boolean' && typeof value.allowRequests === 'boolean' && typeof value.emailInvites === 'boolean' && typeof value.emailReminders === 'boolean'
    && object(value.avatar) && keys(value.avatar, ['color']) && INITIALS_COLOR_KEYS.includes(value.avatar.color as never)
    && Array.isArray(value.links) && value.links.length <= MAX_SOCIAL_LINKS && value.links.every((link) => cleanSocialLink(link) !== null);
}
/** A profile photo: a browser re-encoded image, checked by its own bytes, not just its label. */
export function decodePhoto(value: unknown, maxBytes = MAX_PHOTO_BYTES): { contentType: string; bytes: Buffer } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2]!, 'base64');
  if (!bytes.length || bytes.length > maxBytes) return null;
  const magic = { 'image/png': bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, 'image/webp': bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' }[match[1]!];
  return magic ? { contentType: match[1]!, bytes } : null;
}
/**
 * A practice piece's strokes: gzipped JSON from the browser. Every stroke is
 * checked like a live party stroke and stored re-compressed, so only clean data is kept.
 */
export function cleanPracticeStrokes(value: unknown, shape: CanvasShape): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(gunzipSync(Buffer.from(value, 'base64'), { maxOutputLength: 80_000_000 }).toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > 200_000) return null;
  let stamps = 0;
  const clean = [];
  for (const item of parsed) {
    const stroke = sanitizeStroke(item, CANVAS_SHAPES[shape]);
    if (!stroke) return null;
    stamps += stroke.stamps.length;
    if (stamps > 400_000) return null;
    clean.push({ ...stroke, painterId: 'me', round: 1 });
  }
  return gzipSync(JSON.stringify(clean));
}
export function validSchedule(value: unknown, now = Date.now()): value is ScheduleInput {
  if (!object(value) || !keys(value, ['title', 'startsAt', 'timeZone', 'durationMinutes', 'settings']) || !text(value.title, 1, 80) || typeof value.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value.startsAt) || !text(value.timeZone, 1, 80) || !cleanPartySettings(value.settings)) return false;
  const time = Date.parse(value.startsAt);
  if (!Number.isFinite(time) || time < now + 60_000 || time > now + 366 * 86400_000 || !Number.isInteger(value.durationMinutes) || Number(value.durationMinutes) < 15 || Number(value.durationMinutes) > 240) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone }); } catch { return false; }
  return true;
}
function send(res: ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); }
async function body(req: IncomingMessage, limit = 8192): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new CommunityError(415, 'Send JSON.');
  let length = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) {
    length += Buffer.byteLength(chunk);
    if (length > limit) throw new CommunityError(413, 'This request is too large.');
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
        if (route === '/avatars') return send(res, 200, await db.avatars(user));
        if (route === '/practice') return send(res, 200, await db.practice(user));
        if (route === '/practice/file' && ID.test(url.searchParams.get('id') ?? '') && ['image', 'thumb', 'strokes'].includes(url.searchParams.get('kind') ?? '')) {
          const file = await db.practiceFile(user, url.searchParams.get('id')!, url.searchParams.get('kind') as 'image' | 'thumb' | 'strokes');
          res.writeHead(200, { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=60', ...(file.gzip ? { 'Content-Encoding': 'gzip' } : {}) }).end(file.bytes);
          return;
        }
        if (route === '/calendar') return send(res, 200, await db.calendarToken(user, false));
        if (route === '/photo' && ID.test(url.searchParams.get('id') ?? '')) {
          const photo = await db.photo(user, url.searchParams.get('id')!);
          res.writeHead(200, { 'Content-Type': photo.contentType, 'Cache-Control': 'private, max-age=86400', 'Content-Disposition': 'inline' }).end(photo.bytes);
          return;
        }
        throw new CommunityError(404, 'This item is unavailable.');
      }
      const now = Date.now();
      if (recent.size > 10000) for (const [key, item] of recent) if (item.until < now) recent.delete(key);
      const limit = recent.get(user);
      if (limit && limit.until > now && limit.count >= 30) throw new CommunityError(429, 'Please wait a minute before trying again.');
      recent.set(user, limit && limit.until > now ? { ...limit, count: limit.count + 1 } : { count: 1, until: now + 60_000 });
      const big = route === '/photo' ? 600_000 : route === '/avatars' ? 250_000 : route === '/practice' ? 24_000_000 : 8192;
      const value = await body(req, big);
      if (route === '/profile' && req.method === 'PUT' && validProfile(value)) { await db.saveProfile(user, { ...value, name: value.name.trim(), bio: value.bio.trim(), links: value.links.map((link) => cleanSocialLink(link)!) }); return send(res, 200, { saved: true }); }
      if (route === '/practice' && req.method === 'PUT' && keys(value, ['id', 'title', 'shape', 'image', 'thumb', 'strokes']) && (value.id === null || ID.test(String(value.id))) && text(value.title, 1, 80) && typeof value.shape === 'string' && value.shape in CANVAS_SHAPES) {
        const shape = value.shape as CanvasShape;
        const image = decodePhoto(value.image, 8_000_000);
        const thumb = decodePhoto(value.thumb, 300_000);
        const strokes = value.strokes === null ? null : cleanPracticeStrokes(value.strokes, shape);
        if (!image || image.contentType !== 'image/png' || !thumb || (value.strokes !== null && !strokes)) throw new CommunityError(400, 'That painting could not be saved.');
        return send(res, 200, await db.savePractice(user, { id: value.id as string | null, title: (value.title as string).trim(), shape, image: image.bytes, thumb, strokes }));
      }
      if (route === '/photo' && req.method === 'PUT' && keys(value, ['image'])) {
        const photo = decodePhoto(value.image);
        if (!photo) throw new CommunityError(400, 'Use a PNG, JPEG or WebP image under 400 KB.');
        return send(res, 200, await db.setPhoto(user, photo.contentType, photo.bytes));
      }
      if (req.method !== 'POST') throw new CommunityError(400, 'This request could not be used.');
      if (route === '/friends' && keys(value, ['target']) && ID.test(String(value.target))) await db.requestFriend(user, String(value.target));
      else if (route === '/friends/respond' && keys(value, ['target', 'action']) && ID.test(String(value.target)) && ['accept', 'decline', 'remove'].includes(String(value.action))) await db.respondFriend(user, String(value.target), value.action as 'accept' | 'decline' | 'remove');
      else if (route === '/parties/now' && keys(value, ['title', 'timeZone', 'durationMinutes', 'settings'])) {
        // Start a party right now (like starting a call): the same record as a planned party, starting this minute,
        // so friends can be invited from the studio and it lands in everyone's history.
        const startsAt = new Date().toISOString();
        if (!validSchedule({ ...value, startsAt: new Date(Date.now() + 120_000).toISOString() })) throw new CommunityError(400, 'Check the details and try again.');
        const input = value as unknown as Omit<ScheduleInput, 'startsAt'>;
        return send(res, 201, await db.schedule(user, { ...input, startsAt, title: input.title.trim(), settings: cleanPartySettings(input.settings)! }));
      }
      else if (route === '/parties' && validSchedule(value)) return send(res, 201, await db.schedule(user, { ...value, title: value.title.trim(), settings: cleanPartySettings(value.settings)! }));
      else if (route === '/parties/invite' && keys(value, ['party', 'friend']) && ID.test(String(value.party)) && ID.test(String(value.friend))) await db.invite(user, String(value.party), String(value.friend));
      else if (route === '/parties/respond' && keys(value, ['party', 'response']) && ID.test(String(value.party)) && ['yes', 'no'].includes(String(value.response))) await db.respondParty(user, String(value.party), value.response as 'yes' | 'no');
      else if (route === '/parties/join' && keys(value, ['token']) && TOKEN.test(String(value.token))) await db.joinShared(user, String(value.token));
      else if (route === '/parties/cancel' && keys(value, ['party']) && ID.test(String(value.party))) await db.cancel(user, String(value.party));
      else if (route === '/parties/link' && keys(value, ['party']) && ID.test(String(value.party))) return send(res, 200, await db.rotateLink(user, String(value.party)));
      else if (route === '/parties/update' && ID.test(String(value.party))) {
        const { party, ...rest } = value;
        if (!validSchedule(rest)) throw new CommunityError(400, 'Check the details and try again.');
        await db.updateParty(user, String(party), { ...rest, title: rest.title.trim(), settings: cleanPartySettings(rest.settings)! });
      }
      else if (route === '/photo/clear' && keys(value, [])) await db.clearPhoto(user);
      else if (route === '/practice/delete' && keys(value, ['id']) && ID.test(String(value.id))) await db.deletePractice(user, String(value.id));
      else if (route === '/avatars' && keys(value, ['id', 'name', 'design']) && (value.id === null || ID.test(String(value.id))) && text(value.name, 1, 40)) return send(res, 200, await db.saveAvatar(user, { id: value.id as string | null, name: (value.name as string).trim(), design: value.design }));
      else if (route === '/avatars/delete' && keys(value, ['id']) && ID.test(String(value.id))) await db.deleteAvatar(user, String(value.id));
      else if (route === '/avatars/default' && keys(value, ['id']) && (value.id === null || ID.test(String(value.id)))) await db.setDefaultAvatar(user, value.id as string | null);
      else if (route === '/calendar/rotate' && keys(value, [])) return send(res, 200, await db.calendarToken(user, true));
      else if (route === '/galleries' && keys(value, ['archiveId', 'title']) && ARCHIVE.test(String(value.archiveId)) && text(value.title, 1, 80)) await db.saveGallery(user, String(value.archiveId), (value.title as string).trim());
      else throw new CommunityError(400, 'Check the details and try again.');
      send(res, 200, { saved: true });
    } catch (error) {
      if (error instanceof CommunityError) return send(res, error.status, { error: error.message });
      send(res, 503, { error: 'Your studio could not be loaded or saved. Please try again.' });
    }
  };
}
/**
 * GET /api/calendar/<token>.ics: someone's parties as a subscribable feed.
 * No sign-in (calendar apps can't sign in); the unguessable link is the key,
 * and it can be replaced from the account's calendar page.
 */
export function createCalendarFeedHandler(deps: Pick<Dependencies, 'configured' | 'store'>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const token = (req.url ?? '').match(/^\/api\/calendar\/([A-Za-z0-9_-]{32})\.ics$/)?.[1];
    res.setHeader('Cache-Control', 'private, max-age=900'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method !== 'GET' || !token || !FEED_TOKEN.test(token)) return void res.writeHead(404).end();
    if (!deps.configured) return void res.writeHead(503).end();
    try {
      const { events } = await (await deps.store()).calendarFeed(token);
      const site = (process.env.ACCOUNT_SITE_ORIGIN || 'https://passthecanvas.party').replace(/\/$/, '');
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="pass-the-canvas.ics"' });
      res.end(calendarFile(events.map((event) => ({ ...event, url: `${site}/account/calendar` })), { name: 'Pass the Canvas parties' }));
    } catch (error) {
      res.writeHead(error instanceof CommunityError ? error.status : 503).end();
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
/** Set by configuredCommunityHandler(); shares its database pool. */
export let calendarFeedHandler: ReturnType<typeof createCalendarFeedHandler> = async (_req, res) => void res.writeHead(503).end();
export function configuredCommunityHandler() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? '';
  // Development only: ACCOUNT_DEV_FAKE_AUTH=1 accepts "dev-<name>" tokens from localhost, so the
  // studio can be tried without Clerk. Refused outright in production.
  const fake = process.env.ACCOUNT_DEV_FAKE_AUTH === '1';
  if (fake && process.env.NODE_ENV === 'production') throw new Error('ACCOUNT_DEV_FAKE_AUTH must never be set in production.');
  const origins = (process.env.ACCOUNT_ALLOWED_ORIGINS ?? (fake ? 'http://localhost:5173' : '')).split(',').map(s => s.trim()).filter(Boolean);
  if (fake && !origins.every((o) => /^http:\/\/localhost(:\d+)?$/.test(o))) throw new Error('ACCOUNT_DEV_FAKE_AUTH only works with localhost origins.');
  const configured = !!((secretKey || fake) && process.env.DATABASE_URL && origins.length);
  const pool = configured ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, query_timeout: 5000 }) : null;
  let initialized: Promise<void> | null = null;
  const store = async () => {
    if (!pool) throw new Error('Not configured');
    initialized ??= initializeCommunitySchema(pool).catch(error => { initialized = null; throw error; });
    await initialized; return postgresCommunityStore(pool);
  };
  calendarFeedHandler = createCalendarFeedHandler({ configured, store });
  return createCommunityHandler({ configured, origins,
    async authenticate(token) {
      if (fake) { if (!/^dev-[a-z0-9]{1,20}$/.test(token)) throw new Error('Not a dev token'); return `user_${token}`; }
      return activeSessionUser(await verifyToken(token, { secretKey, authorizedParties: origins }));
    },
    store
  });
}
