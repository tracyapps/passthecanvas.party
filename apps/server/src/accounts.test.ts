import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { activeSessionUser, createAccountHandler, validAccountWorkspaces } from './accounts';

const layout = { positions: { pencil: { x: 0.5, y: 1 } }, order: ['pencil'], dock: 'surround', frame: null, rotation: 0 };
const views = { version: 1, current: layout, views: [{ id: 'a', name: 'My table', layout }], selected: 'a' };
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }))); });
async function setup(overrides: Record<string, unknown> = {}) {
  const store = { load: vi.fn(async (_user: string): Promise<unknown | null> => views), save: vi.fn(async (_user: string, _value: unknown) => {}) };
  const authenticate = vi.fn(async (token: string) => { if (token !== 'valid') throw new Error('invalid'); return 'user_verified'; });
  const handler = createAccountHandler({ configured: true, origins: ['https://canvas.example'], authenticate, store, ...overrides });
  const server = createServer((req, res) => void handler(req, res)); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return { url: `http://127.0.0.1:${address.port}`, store, authenticate };
}
const headers = { Authorization: 'Bearer valid', Origin: 'https://canvas.example', 'Content-Type': 'application/json' };
describe('account workspace boundary', () => {
  it('requires a completed user session after signature verification', () => {
    expect(activeSessionUser({ sub: 'user_owner', sid: 'sess_1' })).toBe('user_owner');
    expect(() => activeSessionUser({ sub: 'user_owner', sid: 'sess_1', sts: 'pending' })).toThrow();
    expect(() => activeSessionUser({ sub: 'user_owner' })).toThrow();
    expect(() => activeSessionUser({ sub: 'org_other', sid: 'sess_1' })).toThrow();
  });
  it('rejects unsigned and invalid sessions before touching storage', async () => {
    const { url, store } = await setup();
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { Authorization: 'Bearer forged' } })).status).toBe(401);
    expect(store.load).not.toHaveBeenCalled();
  });
  it('uses only verified identity to load and save, never query or body identity', async () => {
    const { url, store } = await setup();
    expect((await fetch(`${url}?userId=user_victim`, { headers })).status).toBe(200);
    expect(store.load).toHaveBeenCalledWith('user_verified');
    expect((await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ ...views, userId: 'user_victim' }) })).status).toBe(400);
    expect(store.save).not.toHaveBeenCalled();
    expect((await fetch(url, { method: 'PUT', headers, body: JSON.stringify(views) })).status).toBe(204);
    expect(store.save).toHaveBeenCalledWith('user_verified', views);
  });
  it('rejects untrusted origins and supports only explicit trusted preflights', async () => {
    const { url, store } = await setup();
    expect((await fetch(url, { headers: { ...headers, Origin: 'https://attacker.example' } })).status).toBe(403);
    const response = await fetch(url, { method: 'OPTIONS', headers });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://canvas.example');
    expect(store.load).not.toHaveBeenCalled();
  });
  it('fails closed when unconfigured or storage fails', async () => {
    const unavailable = await setup({ configured: false });
    expect((await fetch(unavailable.url, { headers })).status).toBe(503);
    expect(unavailable.authenticate).not.toHaveBeenCalled();
    const broken = await setup(); broken.store.load.mockRejectedValueOnce(new Error('private database error'));
    const response = await fetch(broken.url, { headers });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database error');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects oversized or malformed saves and corrupt stored layouts', async () => {
    const { url, store } = await setup();
    expect((await fetch(url, { method: 'PUT', headers, body: 'x'.repeat(100001) })).status).toBe(413);
    expect((await fetch(url, { method: 'PUT', headers, body: '{' })).status).toBe(400);
    expect(store.save).not.toHaveBeenCalled();
    store.load.mockResolvedValueOnce({ version: 999 });
    expect((await fetch(url, { headers })).status).toBe(503);
  });
  it('validates geometry, limits, unique IDs and selected view references', () => {
    expect(validAccountWorkspaces(views)).toBe(true);
    expect(validAccountWorkspaces({ ...views, current: { ...layout, rotation: 4 } })).toBe(false);
    expect(validAccountWorkspaces({ ...views, current: { ...layout, positions: { pencil: { x: Infinity, y: 0 } } } })).toBe(false);
    expect(validAccountWorkspaces({ ...views, views: [views.views[0], views.views[0]] })).toBe(false);
    expect(validAccountWorkspaces({ ...views, selected: 'missing' })).toBe(false);
    expect(validAccountWorkspaces({ ...views, current: { ...layout, frame: { width: 10, height: 1 } } })).toBe(false);
  });
});
