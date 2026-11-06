/**
 * Personal app settings: how often practice pieces auto-save, and how big the
 * interface is drawn. Kept in this browser (so they apply instantly, even
 * signed out) and, when signed in, in your account (so every device matches).
 *
 * Interface size: on the site and account pages the whole page scales. On the
 * painting table only the chrome scales (header, panels, menus, zoom bar); the
 * canvas and supplies keep their own sizing, and the page itself can't be
 * pinch-zoomed there, so this is the way to make the controls bigger.
 */
import { cleanPreferences, DEFAULT_PREFERENCES, type StudioPreferences } from '@ptc/shared';
import { accountRequest, accountState, initializeAccount } from './account/account.svelte';

const KEY = 'ptc:preferences';

function storageKey(user: string | null) { return user ? `${KEY}:${user}` : KEY; }
function readLocal(user: string | null): StudioPreferences {
  try { return cleanPreferences(JSON.parse(localStorage.getItem(storageKey(user)) ?? '{}')); } catch { return { ...DEFAULT_PREFERENCES }; }
}
function writeLocal(user: string | null, value: StudioPreferences) {
  try { localStorage.setItem(storageKey(user), JSON.stringify(value)); } catch { /* private mode: settings last for this visit */ }
}

let activeUser = accountState.userId;
let revision = 0;
export const prefs = $state<StudioPreferences>(readLocal(activeUser));

function useAccount(user: string | null) {
  if (activeUser === user) return;
  activeUser = user;
  revision += 1;
  Object.assign(prefs, readLocal(user));
  applyPreferences();
}

/** Puts the interface size on the page (as --ui-scale). */
export function applyPreferences() {
  document.documentElement.style.setProperty('--ui-scale', String(prefs.interfaceScale));
}

let loadedFor: string | null | undefined;
/** Fetch the current artist's settings once per sign-in. */
export async function loadPreferences(): Promise<void> {
  useAccount(accountState.userId);
  await initializeAccount();
  const user = accountState.userId;
  useAccount(user);
  if (loadedFor === user) return;
  loadedFor = user;
  if (!user) return;
  const before = revision;
  try {
    const saved = cleanPreferences(await accountRequest<StudioPreferences>('community/preferences'));
    // A slow load should never overwrite newer edits or another artist's settings.
    if (before !== revision || user !== accountState.userId) return;
    Object.assign(prefs, saved);
    writeLocal(user, saved);
    applyPreferences();
  } catch { /* offline or no profile yet: keep this artist's browser copy */ }
}

let pendingSave: Promise<unknown> = Promise.resolve();
/** Change settings immediately and write account changes in the same order. */
export async function savePreferences(next: Partial<StudioPreferences>): Promise<void> {
  const user = accountState.userId;
  useAccount(user);
  const saved = cleanPreferences({ ...$state.snapshot(prefs), ...next });
  revision += 1;
  Object.assign(prefs, saved);
  writeLocal(user, saved);
  applyPreferences();
  if (!user) return;
  const request = pendingSave.catch(() => {}).then(() => {
    if (accountState.userId !== user) throw new Error('The signed-in account changed.');
    return accountRequest('community/preferences', 'PUT', saved);
  });
  pendingSave = request;
  await request;
}
