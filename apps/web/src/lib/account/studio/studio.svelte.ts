// The signed-in studio's data: one store shared by every account page, so
// moving between pages never reloads or loses what you were doing.

import { sanitizeAvatarDesign, type CommunityHome, type SavedAvatar } from '@ptc/shared';
import { accountRequest, accountState, accountToken } from '../account.svelte';

export const studio = $state({
  home: null as CommunityHome | null,
  avatars: [] as SavedAvatar[],
  loading: false,
  error: '',
  notice: ''
});

/** Profile photos, fetched with the session (they're not public) and kept as object URLs. */
const photoUrls = $state<Record<string, string>>({});
const fetching = new Set<string>();

export async function refresh(): Promise<void> {
  if (!accountState.userId) return;
  studio.loading = true;
  studio.error = '';
  try {
    const [home, avatars] = await Promise.all([accountRequest<CommunityHome>('community'), accountRequest<SavedAvatar[]>('community/avatars')]);
    studio.home = home;
    // Never render a design that didn't pass the same checks the server uses.
    studio.avatars = avatars.flatMap((a) => {
      const design = sanitizeAvatarDesign(a.design);
      return design ? [{ ...a, design }] : [];
    });
  } catch (cause) {
    studio.error = cause instanceof Error ? cause.message : 'Your studio could not load.';
  } finally {
    studio.loading = false;
  }
}

/**
 * Live updates: while a studio page is open and visible, check for changes made
 * elsewhere (your other devices, friends, invitations) every 15 seconds, and
 * straight away when you come back to the tab. Only what changed is replaced,
 * so nothing flickers and forms you're filling in are left alone.
 * `live.tick` goes up on every check, for pages with their own data (practice pieces).
 */
export const live = $state({ tick: 0, checkedAt: 0 });
let checking = false;
async function quietRefresh(): Promise<void> {
  if (checking || !accountState.userId || studio.loading) return;
  checking = true;
  try {
    const [home, avatars] = await Promise.all([accountRequest<CommunityHome>('community'), accountRequest<SavedAvatar[]>('community/avatars')]);
    if (JSON.stringify(home) !== JSON.stringify($state.snapshot(studio.home))) studio.home = home;
    const clean = avatars.flatMap((a) => { const design = sanitizeAvatarDesign(a.design); return design ? [{ ...a, design }] : []; });
    if (JSON.stringify(clean) !== JSON.stringify($state.snapshot(studio.avatars))) studio.avatars = clean;
  } catch { /* offline for a moment: try again next time */ }
  finally { checking = false; live.tick += 1; live.checkedAt = Date.now(); }
}
export function startLiveUpdates(every = 15_000): () => void {
  const check = () => { if (document.visibilityState === 'visible') void quietRefresh(); };
  const timer = setInterval(check, every);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); window.removeEventListener('online', check); };
}

export function clearStudio() {
  studio.home = null;
  studio.avatars = [];
  studio.error = '';
  studio.notice = '';
  for (const url of Object.values(photoUrls)) URL.revokeObjectURL(url);
  for (const key of Object.keys(photoUrls)) delete photoUrls[key];
}

/** Run a change, then reload, and say how it went (in the page's live region). */
export async function act<T = unknown>(path: string, value: unknown, message: string, method: 'POST' | 'PUT' = 'POST'): Promise<T | null> {
  studio.error = '';
  studio.notice = '';
  try {
    const result = await accountRequest<T>(`community/${path}`, method, value);
    await refresh();
    studio.notice = message;
    return result;
  } catch (cause) {
    studio.error = cause instanceof Error ? cause.message : 'That change could not be saved.';
    return null;
  }
}

/** The photo URL for a profile (id + version), loading it the first time. */
export function photoUrl(profileId: string, version: string | null): string | null {
  if (!version) return null;
  const key = `${profileId}:${version}`;
  if (photoUrls[key]) return photoUrls[key]!;
  if (!fetching.has(key)) {
    fetching.add(key);
    void (async () => {
      try {
        const token = await accountToken();
        const base = (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');
        const response = await fetch(`${base}/api/account/community/photo?id=${encodeURIComponent(profileId)}&v=${encodeURIComponent(version)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) photoUrls[key] = URL.createObjectURL(await response.blob());
      } catch {
        /* the initials show instead */
      }
    })();
  }
  return null;
}

/** Local date and time, in the viewer's own time zone. */
export function when(value: string, style: 'full' | 'date' | 'time' = 'full'): string {
  const date = new Date(value);
  if (style === 'date') return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (style === 'time') return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ---------- in-app navigation ----------

export const route = $state({ path: location.pathname.replace(/\/$/, '') || '/account' });

/** Move to another account page without reloading (links still work without this). */
export function go(path: string, event?: MouseEvent) {
  if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return;
  event?.preventDefault();
  if (path !== location.pathname + location.search) history.pushState(null, '', path);
  route.path = location.pathname.replace(/\/$/, '') || '/account';
  studio.notice = '';
  studio.error = '';
  // Land focus on the new page's heading, so keyboard and screen-reader users know it changed.
  queueMicrotask(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('#studio-page h1')?.focus()));
}

addEventListener('popstate', () => {
  route.path = location.pathname.replace(/\/$/, '') || '/account';
});
