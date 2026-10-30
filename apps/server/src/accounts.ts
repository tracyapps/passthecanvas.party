// Account settings stay separate from party membership and painting ownership.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyToken } from '@clerk/backend';
import pg from 'pg';

const MAX_BYTES = 100_000;
interface WorkspaceStore {
  load(userId: string): Promise<unknown | null>;
  save(userId: string, value: unknown): Promise<void>;
}
interface AccountDependencies {
  configured: boolean;
  origins: string[];
  authenticate(token: string): Promise<string>;
  store: WorkspaceStore;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function shortText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80;
}
function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
function validLayout(value: unknown): boolean {
  if (!record(value) || !hasKeys(value, ['positions', 'order', 'dock', 'frame', 'rotation'])) return false;
  if (!record(value.positions) || Object.keys(value.positions).length > 32) return false;
  for (const [id, position] of Object.entries(value.positions)) {
    if (!shortText(id) || !record(position) || !hasKeys(position, ['x', 'y'])) return false;
    if (![position.x, position.y].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 4)) return false;
  }
  if (!Array.isArray(value.order) || value.order.length > 32 || !value.order.every(shortText)) return false;
  if (!['surround', 'left', 'right', 'both'].includes(String(value.dock))) return false;
  if (!Number.isInteger(value.rotation) || Number(value.rotation) < 0 || Number(value.rotation) > 3) return false;
  if (value.frame !== null) {
    if (!record(value.frame) || !hasKeys(value.frame, ['width', 'height'])) return false;
    if (![value.frame.width, value.frame.height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 2)) return false;
  }
  return true;
}
export function validAccountWorkspaces(value: unknown): boolean {
  if (!record(value) || !hasKeys(value, ['version', 'current', 'views', 'selected'])) return false;
  if (value.version !== 1 || !validLayout(value.current) || !shortText(value.selected)) return false;
  if (!Array.isArray(value.views) || value.views.length > 30) return false;
  const ids = new Set<string>();
  for (const view of value.views) {
    if (!record(view) || !hasKeys(view, ['id', 'name', 'layout']) || !shortText(view.id) || !view.id || !shortText(view.name) || !view.name.trim() || !validLayout(view.layout)) return false;
    if (ids.has(view.id)) return false;
    ids.add(view.id);
  }
  return value.selected === '' || ids.has(value.selected);
}

export function createAccountHandler(dependencies: AccountDependencies) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin && !dependencies.origins.includes(origin)) return respond(res, 403, 'This origin is not allowed.');
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.writeHead(204).end(); return;
    }
    if (!['GET', 'PUT'].includes(req.method ?? '')) {
      res.setHeader('Allow', 'GET, PUT, OPTIONS');
      return respond(res, 405, 'Method not allowed.');
    }
    if (!dependencies.configured) return respond(res, 503, 'Account storage is not configured.');
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) return respond(res, 401, 'Sign in to access saved views.');
    let userId: string;
    try {
      userId = await dependencies.authenticate(authorization.slice(7));
      if (!userId) throw new Error('Missing user');
    } catch {
      return respond(res, 401, 'Your sign-in expired. Sign in again.');
    }
    try {
      if (req.method === 'GET') {
        const value = await dependencies.store.load(userId);
        if (value !== null && !validAccountWorkspaces(value)) return respond(res, 503, 'Saved views could not be read.');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
        return;
      }
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return respond(res, 415, 'Send saved views as JSON.');
      let bytes = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_BYTES) return respond(res, 413, 'Saved views are too large.');
        chunks.push(Buffer.from(chunk));
      }
      let value: unknown;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return respond(res, 400, 'Saved views contain invalid JSON.'); }
      if (!validAccountWorkspaces(value)) return respond(res, 400, 'Saved views failed validation.');
      // The verified subject is the only storage key. Body fields cannot select another user.
      await dependencies.store.save(userId, value);
      res.writeHead(204).end();
    } catch {
      respond(res, 503, 'Account storage is unavailable. Your local views have not changed.');
    }
  };
}
function respond(res: ServerResponse, status: number, error: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error }));
}

export function activeSessionUser(claims: { sub?: unknown; sid?: unknown; sts?: unknown }): string {
  if (typeof claims.sub !== 'string' || !claims.sub.startsWith('user_') || typeof claims.sid !== 'string' || !claims.sid || claims.sts === 'pending') throw new Error('Not an active user session');
  return claims.sub;
}

export function configuredAccountHandler() {
  const secretKey = process.env.CLERK_SECRET_KEY ?? '';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const origins = (process.env.ACCOUNT_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  const configured = Boolean(secretKey && databaseUrl && origins.length);
  // No database connection is attempted until an authenticated settings request arrives.
  const pool = configured ? new pg.Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 5000, query_timeout: 5000 }) : null;
  let initialized: Promise<unknown> | null = null;
  async function database() {
    if (!pool) throw new Error('Not configured');
    initialized ??= pool.query(`CREATE TABLE IF NOT EXISTS account_workspaces (
      user_id text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    )`).catch(error => { initialized = null; throw error; });
    await initialized;
    return pool;
  }
  return createAccountHandler({
    configured, origins,
    async authenticate(token) {
      const claims = await verifyToken(token, { secretKey, authorizedParties: origins });
      return activeSessionUser(claims);
    },
    store: {
      async load(userId) {
        const db = await database();
        const result = await db.query('SELECT value FROM account_workspaces WHERE user_id = $1', [userId]);
        return result.rows[0]?.value ?? null;
      },
      async save(userId, value) {
        const db = await database();
        await db.query(`INSERT INTO account_workspaces (user_id, value) VALUES ($1, $2::jsonb)
          ON CONFLICT (user_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [userId, JSON.stringify(value)]);
      }
    }
  });
}
