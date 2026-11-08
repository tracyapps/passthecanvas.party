<script lang="ts">
  import { onMount } from 'svelte';
  import {
    accountState,
    initializeAccount,
    loadAccountWorkspaces,
    saveAccountWorkspaces,
  } from '../account.svelte';
  import {
    defaultLayout,
    decodeWorkspaces,
    mergeViewEdits,
    WORKSPACE_KEY,
    type WorkspaceState,
    type SavedWorkspace,
  } from '../../canvas/workspaces';
  import { SUPPLIES } from '../../canvas/supplies';
  import WorkspaceManager from '../../canvas/WorkspaceManager.svelte';
  const ids = SUPPLIES.map((supply) => supply.id);
  let workspace = $state<WorkspaceState>({
    version: 1,
    current: defaultLayout(ids),
    views: [],
    selected: '',
    toolboxes: [],
  });
  let ready = $state(false);
  let note = $state('');
  let blocked = $state(false);
  let accountReady = false;
  let queue = Promise.resolve();
  let user = $state<string | null>(null);
  function key() {
    return user ? `${WORKSPACE_KEY}:${user}` : WORKSPACE_KEY;
  }
  function localState() {
    const raw = localStorage.getItem(key());
    return raw ? decodeWorkspaces(raw, ids) : $state.snapshot(workspace);
  }
  onMount(() => {
    let active = true;
    void (async () => {
      await initializeAccount();
      user = accountState.userId;
      try {
        const local = localState();
        if (active) workspace = local;
      } catch {
        note = 'Browser views could not be read. The stored copy has been kept.';
        blocked = true;
        return;
      }
      try {
        if (user) {
          const remote = await loadAccountWorkspaces();
          if (!active || accountState.userId !== user) return;
          if (remote !== null) {
            const saved = decodeWorkspaces(JSON.stringify(remote), ids);
            const browser = localStorage.getItem(key());
            // Keep the active browser desk while bringing the account's view library into sync.
            workspace = browser
              ? {
                  ...decodeWorkspaces(browser, ids),
                  views: saved.views,
                  toolboxes: saved.toolboxes,
                }
              : saved;
            localStorage.setItem(key(), JSON.stringify($state.snapshot(workspace)));
          }
          accountReady = true;
        }
        ready = true;
      } catch {
        if (active) {
          ready = true;
          note =
            'Account views could not load. Reopen this page after reconnecting to save changes.';
        }
      }
    })();
    return () => {
      active = false;
    };
  });
  async function update(views: SavedWorkspace[]) {
    const before = $state.snapshot(workspace.views);
    const after = structuredClone($state.snapshot(views));
    const owner = user;
    let next = mergeViewEdits(localState(), before, after);
    if (owner) {
      if (!accountReady)
        throw new Error(
          'Account views are unavailable. Your edits are still here. Reconnect and try again.'
        );
      const save = queue
        .catch(() => {})
        .then(async () => {
          if (accountState.userId !== owner) throw new Error('Your signed-in account changed.');
          const remote = await loadAccountWorkspaces();
          const latest =
            remote === null ? localState() : decodeWorkspaces(JSON.stringify(remote), ids);
          const merged = mergeViewEdits(latest, before, after);
          if (accountState.userId !== owner) throw new Error('Your signed-in account changed.');
          await saveAccountWorkspaces(merged, owner);
          next = { ...localState(), views: merged.views };
        });
      queue = save.catch(() => {});
      await save;
    }
    localStorage.setItem(key(), JSON.stringify(next));
    workspace = next;
  }
  function apply(view: SavedWorkspace) {
    try {
      const latest = localState();
      const next = {
        ...latest,
        current: structuredClone($state.snapshot(view.layout)),
        selected: view.id,
      };
      localStorage.setItem(key(), JSON.stringify(next));
      workspace = next;
      note = `${view.name} will open the next time you enter the painting table.`;
      if (accountReady && user) {
        const owner = user;
        queue = queue
          .catch(() => {})
          .then(async () => {
            if (accountState.userId !== owner) return;
            const remote = await loadAccountWorkspaces();
            const latest = remote === null ? next : decodeWorkspaces(JSON.stringify(remote), ids);
            if (accountState.userId !== owner) return;
            await saveAccountWorkspaces(
              { ...latest, current: next.current, selected: next.selected },
              owner
            );
          })
          .catch(() => {
            note = 'The view is selected on this browser. Account sync failed.';
          });
      }
    } catch {
      note = 'The view could not be selected.';
    }
  }
</script>

<header class="page-head">
  <div>
    <p class="eyebrow">Your studio</p>
    <h1 tabindex="-1">Saved views</h1>
  </div>
</header>
<p class="status" role="status">{note}</p>
{#if ready}<WorkspaceManager
    views={workspace.views}
    toolboxes={workspace.toolboxes ?? []}
    current={workspace.current}
    selected={workspace.selected}
    signedIn={!!user}
    onupdate={update}
    onapply={apply}
  />
{:else if !blocked}<p>Loading saved views…</p>{/if}
