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

function readLocal(): StudioPreferences {
  try { return cleanPreferences(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return { ...DEFAULT_PREFERENCES }; }
}
function writeLocal() {
  try { localStorage.setItem(KEY, JSON.stringify($state.snapshot(prefs))); } catch { /* private mode: settings last for this visit */ }
}

export const prefs = $state<StudioPreferences>(readLocal());

/** Puts the interface size on the page (as --ui-scale). */
export function applyPreferences() {
  document.documentElement.style.setProperty('--ui-scale', String(prefs.interfaceScale));
}

let loadedFor: string | null | undefined;
/** Fetch your account's settings once you're signed in (the browser copy is used until then). */
export async function loadPreferences(): Promise<void> {
  await initializeAccount();
  const user = accountState.userId;
  if (!user || loadedFor === user) return;
  loadedFor = user;
  try {
    Object.assign(prefs, cleanPreferences(await accountRequest<StudioPreferences>('community/preferences')));
    writeLocal();
    applyPreferences();
  } catch { /* offline or no profile yet: keep the browser copy */ }
}

/** Change settings: applied right away, then saved to the browser and your account. */
export async function savePreferences(next: Partial<StudioPreferences>): Promise<void> {
  Object.assign(prefs, cleanPreferences({ ...$state.snapshot(prefs), ...next }));
  writeLocal();
  applyPreferences();
  if (accountState.userId) await accountRequest('community/preferences', 'PUT', $state.snapshot(prefs));
}
