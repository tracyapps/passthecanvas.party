// One Clerk client for this browser. Local saved views are never imported automatically.
import type { Clerk } from '@clerk/clerk-js';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
export const accountState = $state({ userId: null as string | null, ready: !publishableKey, configured: Boolean(publishableKey), error: '' });
let clerk: Clerk | null = null;
let initialization: Promise<void> | null = null;
type ClerkOptions = NonNullable<Parameters<Clerk['load']>[0]>;
type ClerkUI = NonNullable<ClerkOptions['ui']>['ClerkUI'];
async function loadAccountUI(): Promise<ClerkUI> {
  const browser = window as Window & { __internal_ClerkUICtor?: ClerkUI };
  if (browser.__internal_ClerkUICtor) return browser.__internal_ClerkUICtor;
  // Clerk 6 separates its prebuilt sign-in/account UI from its session client.
  const domain = atob(publishableKey.split('_')[2] ?? '').replace(/\$$/, '');
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error('Invalid account domain');
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error('Account UI timed out')); }, 20000);
    script.src = `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`;
    script.async = true; script.crossOrigin = 'anonymous';
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Account UI unavailable')); };
    document.head.append(script);
  });
  if (!browser.__internal_ClerkUICtor) throw new Error('Account UI unavailable');
  return browser.__internal_ClerkUICtor;
}

export function initializeAccount(): Promise<void> {
  if (!publishableKey) return Promise.resolve();
  initialization ??= (async () => {
    try {
      const { Clerk } = await import('@clerk/clerk-js');
      clerk = new Clerk(publishableKey);
      await clerk.load({ telemetry: { disabled: true }, ui: { ClerkUI: await loadAccountUI() } });
      clerk.addListener(({ user }) => { accountState.userId = user?.id ?? null; });
      accountState.userId = clerk.user?.id ?? null;
      accountState.error = '';
    } catch {
      accountState.error = 'Account sign-in could not load. Check your connection and try again.';
      initialization = null;
    } finally {
      accountState.ready = true;
    }
  })();
  return initialization;
}
export async function openAccountSignIn(): Promise<void> {
  accountState.ready = false;
  try {
    await initializeAccount();
    if (!clerk || accountState.error) return;
    // Email codes and Discord are enabled in the Clerk instance, never hard-coded as available.
    clerk.openSignIn({ fallbackRedirectUrl: window.location.href, signUpFallbackRedirectUrl: window.location.href });
  } catch {
    accountState.error = 'Account sign-in could not open. Please try again.';
  } finally {
    // Initialization is shared, so later calls may receive an already resolved promise.
    accountState.ready = true;
  }
}
export async function signOutAccount(): Promise<void> {
  try {
    await clerk?.signOut();
    accountState.userId = null;
  } catch {
    accountState.error = 'Sign-out failed. Please try again.';
  }
}
export async function accountRequest<T>(path: string, method: 'GET' | 'PUT' | 'POST' = 'GET', value?: unknown): Promise<T> {
  await initializeAccount();
  const userId = accountState.userId;
  const token = await clerk?.session?.getToken();
  if (!token || !userId) throw new Error('Sign in to access account views.');
  const base = (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');
  const response = await fetch(`${base}/api/account/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) },
    body: method !== 'GET' ? JSON.stringify(value) : undefined, cache: 'no-store'
  });
  // A result from an earlier identity must not be applied after switching accounts.
  if (userId !== accountState.userId) throw new Error('The signed-in account changed. Try again.');
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === 'string' ? body.error : 'Account views could not be saved or loaded.');
  }
  const result = response.status === 204 ? null : await response.json();
  if (userId !== accountState.userId) throw new Error('The signed-in account changed. Try again.');
  return result as T;
}
export function loadAccountWorkspaces(): Promise<unknown | null> { return accountRequest('workspaces'); }
export async function saveAccountWorkspaces(value: unknown): Promise<void> { await accountRequest('workspaces', 'PUT', value); }

export function manageAccount(): void { clerk?.openUserProfile(); }
