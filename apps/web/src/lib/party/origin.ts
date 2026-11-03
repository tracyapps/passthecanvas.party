// Where the party server lives. In dev it's this same origin (Vite proxies
// /party, /api and /snapshots). In production the website is on Vercel and
// the party server on Railway, so paths are prefixed with the server's
// origin: VITE_PARTY_URL, or the account API's origin (same Railway server).

const BASE = (import.meta.env.VITE_PARTY_URL || import.meta.env.VITE_ACCOUNT_API_URL || '').replace(/\/$/, '');

/** A server path ("/snapshots/…", "/api/…") as a URL the browser can load. */
export function partyUrl(path: string): string {
  return BASE && path.startsWith('/') ? BASE + path : path;
}

/** The WebSocket address for a party. */
export function partySocketUrl(partyId: string): string {
  if (BASE) return `${BASE.replace(/^http/, 'ws')}/party/${partyId}`;
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${location.host}/party/${partyId}`;
}
