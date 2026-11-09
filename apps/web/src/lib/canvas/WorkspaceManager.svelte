<script lang="ts">
  import { onMount } from 'svelte';
  import {
    defaultLayout,
    type SavedWorkspace,
    type WorkspaceLayout,
    type WorkspaceSurface,
  } from './workspaces';
  import type { Toolbox } from './toolboxes';
  import { shownSupplies, findToolbox } from './toolboxes';
  import { SUPPLIES } from './supplies';
  import { workspaceGeometry, canvasTop, compactSurface, keepFrameOnSurface, layoutForSurface } from './workspace-geometry';
  import WorkspacePreview from './WorkspacePreview.svelte';

  let {
    views,
    toolboxes,
    current,
    selected = '',
    onupdate,
    onapply,
    onclose,
    signedIn = false,
  }: {
    views: SavedWorkspace[];
    toolboxes: Toolbox[];
    current: WorkspaceLayout;
    selected?: string;
    onupdate: (views: SavedWorkspace[]) => Promise<void>;
    onapply: (view: SavedWorkspace) => void;
    onclose?: () => void;
    signedIn?: boolean;
  } = $props();
  const desktop: WorkspaceSurface = {
    width: 1440,
    height: 900,
    headerHeight: 88,
    toolbarHeight: 80,
  };
  let draft = $state<SavedWorkspace | null>(null);
  let baseline = $state('');
  let target = $state('canvas');
  let device = $state('saved');
  let pending = $state<(() => void) | null>(null);
  let deleting = $state<string[]>([]);
  let checked = $state<string[]>([]);
  let renaming = $state('');
  let rename = $state('');
  let saving = $state(false);
  let note = $state('');
  let nameInput = $state<HTMLInputElement>();
  let dirty = $derived(!!draft && JSON.stringify(draft) !== baseline);
  let viewport = $derived(draft?.layout.surface ?? desktop);
  let flowing = $derived(compactSurface(viewport) || draft?.layout.dock !== 'surround');
  function changeSize(value: string) {
    if (!draft) return;
    device = value;
    const surface = value === 'phone' ? { ...desktop, width: 360, height: 800, headerHeight: 160 }
      : value === 'tablet' ? { ...desktop, width: 1024, height: 768, headerHeight: 120 }
      : value === 'wide' ? { ...desktop, width: 1920, height: 1080 } : desktop;
    draft.layout = layoutForSurface(draft.layout, surface);
  }
  function reorder(direction: number) {
    if (!draft || target === 'canvas') return;
    const shown = draft.layout.order.filter(id => draft!.layout.supplies?.includes(id));
    const index = shown.indexOf(target);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= shown.length) return;
    [shown[index], shown[next]] = [shown[next], shown[index]];
    draft.layout = { ...draft.layout, order: [...shown, ...draft.layout.order.filter(id => !shown.includes(id))] };
  }
  let selectedRect = $derived(
    draft
      ? target === 'canvas'
        ? workspaceGeometry(draft.layout, draft.layout.surface ?? desktop).frame
        : workspaceGeometry(draft.layout, draft.layout.surface ?? desktop).boxes[target]
      : undefined
  );

  function resolved(layout: WorkspaceLayout): WorkspaceLayout {
    const copy = structuredClone($state.snapshot(layout));
    copy.toolView = copy.toolView === 'grid' ? 'grid' : 'cutouts';
    copy.supplies ??= shownSupplies(
      copy.order,
      findToolbox(copy.toolbox ?? 'everything', toolboxes)
    );
    copy.surface ??= { ...desktop };
    const geometry = workspaceGeometry(copy, copy.surface);
    copy.positions = {
      ...copy.positions,
      ...Object.fromEntries(
        Object.entries(geometry.boxes).map(([id, box]) => [
          id,
          { x: box.x / copy.surface!.width, y: box.y / copy.surface!.height },
        ])
      ),
    };
    copy.frame ??= {
      x: geometry.frame.x / copy.surface.width,
      y: geometry.frame.y / copy.surface.height,
      width: geometry.frame.width / copy.surface.width,
      height: geometry.frame.height / copy.surface.height,
    };
    return copy;
  }
  function guard(action: () => void) {
    if (saving) return;
    if (dirty) pending = action;
    else action();
  }
  function edit(view: SavedWorkspace, duplicate = false) {
    guard(() => {
      draft = {
        id: duplicate ? crypto.randomUUID() : view.id,
        name: duplicate ? `${view.name.slice(0, 70)} copy` : view.name,
        layout: resolved(view.layout),
      };
      baseline =
        duplicate || !views.some((item) => item.id === draft?.id) ? '' : JSON.stringify(draft);
      target = 'canvas';
      device = 'saved';
      deleting = [];
      note = '';
      queueMicrotask(() => nameInput?.focus());
    });
  }
  function uniqueName(name: string, entries = views) {
    const base = name.slice(0, 70);
    let result = base;
    let suffix = 2;
    while (entries.some((view) => view.name.toLowerCase() === result.toLowerCase())) {
      result = `${base} ${suffix++}`;
    }
    return result;
  }
  function newView(fromCurrent = false) {
    if (views.length >= 30) {
      note = 'Up to 30 saved views.';
      return;
    }
    const layout = fromCurrent
      ? current
      : {
          ...defaultLayout(SUPPLIES.map((supply) => supply.id)),
          toolView: 'cutouts' as const,
          supplies: [],
          surface: current.surface ?? desktop,
        };
    edit({ id: crypto.randomUUID(), name: uniqueName('New view'), layout });
  }
  async function persist(next: SavedWorkspace[]) {
    saving = true;
    note = signedIn ? 'Saving to your account…' : 'Saving…';
    try {
      await onupdate(next);
      note = signedIn
        ? 'Saved to your account.'
        : 'Saved on this device. Sign in to keep views in your account.';
      return true;
    } catch (error) {
      note =
        error instanceof Error
          ? error.message
          : 'Save failed. Your edits are still here. Try again.';
      return false;
    } finally {
      saving = false;
    }
  }
  function validName(name: string, id: string) {
    if (!name) {
      note = 'Give this view a name.';
      return false;
    }
    if (
      views.some((view) => view.id !== id && view.name.trim().toLowerCase() === name.toLowerCase())
    ) {
      note = 'A view with that name already exists. Choose another name.';
      return false;
    }
    return true;
  }
  async function save() {
    if (!draft || saving) return;
    const name = draft.name.trim();
    if (!validName(name, draft.id)) {
      nameInput?.focus();
      return;
    }
    if (!views.some((view) => view.id === draft?.id) && views.length >= 30) {
      note = 'Up to 30 saved views.';
      return;
    }
    const saved = structuredClone($state.snapshot({ ...draft, name }));
    const next = views.some((view) => view.id === saved.id)
      ? views.map((view) => (view.id === saved.id ? saved : view))
      : [...views, saved];
    if (await persist(next)) {
      draft = saved;
      baseline = JSON.stringify(saved);
    }
  }
  async function remove() {
    if (saving) return;
    const ids = [...deleting];
    if (await persist(views.filter((view) => !ids.includes(view.id)))) {
      if (draft && ids.includes(draft.id)) {
        draft = null;
        baseline = '';
      }
      deleting = [];
      checked = [];
    }
  }
  async function duplicate(ids: string[]) {
    if (views.length + ids.length > 30) {
      note = 'Up to 30 saved views.';
      return;
    }
    const next = [...views];
    for (const view of views.filter((view) => ids.includes(view.id))) {
      next.push({
        ...structuredClone($state.snapshot(view)),
        id: crypto.randomUUID(),
        name: uniqueName(`${view.name} copy`, next),
      });
    }
    if (await persist(next)) checked = [];
  }
  async function saveRename(view: SavedWorkspace) {
    const name = rename.trim();
    if (!validName(name, view.id)) return;
    if (await persist(views.map((item) => (item.id === view.id ? { ...item, name } : item))))
      renaming = '';
  }
  function gallery() {
    guard(() => {
      draft = null;
      baseline = '';
      deleting = [];
      note = '';
    });
  }
  function toggle(id: string, enabled: boolean) {
    if (!draft) return;
    const ids = new Set(draft.layout.supplies);
    if (enabled) ids.add(id);
    else ids.delete(id);
    draft.layout = { ...draft.layout, supplies: draft.layout.order.filter((id) => ids.has(id)) };
  }
  function place(field: 'x' | 'y' | 'width' | 'height', value: number) {
    if (!draft || !Number.isFinite(value)) return;
    const surface = draft.layout.surface!;
    if (target === 'canvas') {
      const frame = { ...draft.layout.frame! };
      frame[field] = Math.max(
        field === 'width'
          ? Math.min(1, 260 / surface.width)
          : field === 'height'
            ? Math.min(1, 200 / surface.height)
            : field === 'y'
              ? canvasTop(surface) / surface.height
              : 0,
        Math.min(1, value / (field === 'x' || field === 'width' ? surface.width : surface.height))
      );
      // Typed numbers can't push the frame past the screen's edges either.
      const kept = keepFrameOnSurface({ x: (frame.x ?? 0) * surface.width, y: (frame.y ?? 0) * surface.height, width: frame.width * surface.width, height: frame.height * surface.height }, surface);
      draft.layout = { ...draft.layout, frame: { x: kept.x / surface.width, y: kept.y / surface.height, width: kept.width / surface.width, height: kept.height / surface.height } };
    } else if (field === 'x' || field === 'y') {
      draft.layout = {
        ...draft.layout,
        positions: {
          ...draft.layout.positions,
          [target]: {
            ...draft.layout.positions[target],
            [field]: Math.max(
              0,
              Math.min(0.98, value / (field === 'x' ? surface.width : surface.height))
            ),
          },
        },
      };
    }
  }
  function keydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (draft) void save();
      return;
    }
    if (event.key === 'Escape' && onclose) {
      event.stopPropagation();
      guard(onclose);
    }
  }
  onMount(() => {
    window.addEventListener('keydown', keydown);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('keydown', keydown);
    };
  });
</script>

<div class="manager" role="group" aria-label="Saved view manager" aria-busy={saving}>
  <header class="manager-head">
    <div>
      <h2>{draft ? 'Edit view' : 'Saved views'}</h2>
      <p>
        {draft
          ? 'Arrange the desk, then save your view.'
          : 'Create views for different screen sizes, then choose one on each device.'}
      </p>
    </div>
    <div class="actions">
      {#if draft}<button type="button" disabled={saving} onclick={gallery}
          >Back to saved views</button
        >{/if}
      {#if onclose}<button type="button" disabled={saving} onclick={() => guard(onclose!)}
          >Close views</button
        >{/if}
    </div>
  </header>
  <p class="status" role="status">{note}</p>
  {#if pending}<div class="confirm" role="alert">
      <p>Discard the unsaved edits?</p>
      <button
        type="button"
        onclick={() => {
          const action = pending;
          pending = null;
          baseline = JSON.stringify(draft);
          action?.();
        }}>Discard edits</button
      >
      <button type="button" onclick={() => (pending = null)}>Keep editing</button>
    </div>{/if}
  {#if deleting.length}<div class="confirm" role="alert">
      <p>
        Delete {deleting.length === 1
          ? `“${views.find((view) => view.id === deleting[0])?.name ?? draft?.name}”`
          : `${deleting.length} selected views`}? Your painting stays open.
      </p>
      <button type="button" disabled={saving} onclick={() => void remove()}>Confirm delete</button>
      <button type="button" disabled={saving} onclick={() => (deleting = [])}>Keep views</button>
    </div>{/if}
  {#if !draft}
    <div class="gallery-actions actions">
      <button type="button" disabled={saving} onclick={() => newView()}>Add view</button>
      <button type="button" disabled={saving} onclick={() => newView(true)}
        >Save current as new view</button
      >
      {#if views.length}<label class="select-all"
          ><input
            type="checkbox"
            checked={checked.length === views.length}
            onchange={(event) =>
              (checked = event.currentTarget.checked ? views.map((view) => view.id) : [])}
          />Select all</label
        >{/if}
      {#if checked.length}<span>{checked.length} selected</span>
        <button type="button" disabled={saving} onclick={() => void duplicate(checked)}
          >Duplicate selected</button
        >
        <button type="button" disabled={saving} onclick={() => (deleting = [...checked])}
          >Delete selected</button
        >
      {/if}
    </div>
    <section class="view-cards" aria-label="Saved view previews">
      {#each views as view (view.id)}
        <article class:active={selected === view.id}>
          <div class="card-top">
            <label
              ><input
                type="checkbox"
                aria-label={`Select ${view.name}`}
                checked={checked.includes(view.id)}
                onchange={(event) =>
                  (checked = event.currentTarget.checked
                    ? [...checked, view.id]
                    : checked.filter((id) => id !== view.id))}
              />Select</label
            >{#if selected === view.id}<span>Current view</span>{/if}
          </div>
          <div class="preview-link">
            <WorkspacePreview
              layout={resolved(view.layout)}
              viewport={view.layout.surface ?? desktop}
            />
            <button
              type="button"
              class="preview-edit"
              aria-label={`Edit ${view.name}`}
              onclick={() => edit(view)}
            ></button>
          </div>
          {#if renaming === view.id}<form
              class="rename actions"
              onsubmit={(event) => {
                event.preventDefault();
                void saveRename(view);
              }}
            >
              <label
                >View name<input
                  aria-label={`Rename ${view.name}`}
                  maxlength="80"
                  bind:value={rename}
                /></label
              ><button disabled={saving} type="submit">Save name</button><button
                type="button"
                onclick={() => (renaming = '')}>Cancel</button
              >
            </form>
          {:else}<h3>{view.name}</h3>{/if}
          <p>{view.layout.toolView === 'grid' ? 'Square buttons' : 'Full cutout images'} · {view.layout.surface?.width ?? desktop.width} × {view.layout.surface?.height ?? desktop.height}</p>
          <div class="actions">
            <button
              type="button"
              disabled={saving}
              aria-label={`Apply ${view.name}`}
              onclick={() => onapply(view)}>Use on this device</button
            >
            <button
              type="button"
              disabled={saving}
              aria-label={`Rename ${view.name}`}
              onclick={() => {
                renaming = view.id;
                rename = view.name;
              }}>Rename</button
            >
            <button
              type="button"
              disabled={saving}
              aria-label={`Duplicate ${view.name}`}
              onclick={() => void duplicate([view.id])}>Duplicate</button
            >
            <button
              type="button"
              disabled={saving}
              aria-label={`Delete ${view.name}`}
              onclick={() => (deleting = [view.id])}>Delete</button
            >
          </div>
        </article>
      {:else}<p>No saved views yet. Add a view to start with an empty desk.</p>{/each}
    </section>
  {:else}
    <section class="editor" aria-label="Edit saved view">
      <header class="edit-head">
        <label
          >View name<input
            bind:this={nameInput}
            maxlength="80"
            bind:value={draft.name}
            disabled={saving}
          /></label
        >
        <span>{dirty ? 'Unsaved edits' : 'Saved'}</span>
        <div class="actions">
          <button type="button" disabled={saving} onclick={() => void save()}
            >{saving ? 'Saving…' : 'Save view'}</button
          >
          <button type="button" disabled={saving || dirty} onclick={() => draft && onapply(draft)}
            >Use on this device</button
          >
          <button
            type="button"
            disabled={saving}
            onclick={() => {
              if (draft) {
                draft = {
                  ...structuredClone($state.snapshot(draft)),
                  id: crypto.randomUUID(),
                  name: uniqueName(`${draft.name} copy`),
                };
                baseline = '';
              }
            }}>Duplicate</button
          >
          {#if views.some((view) => view.id === draft?.id)}<button
              type="button"
              disabled={saving}
              onclick={() => guard(() => (deleting = [draft!.id]))}>Delete</button
            >{/if}
        </div>
      </header>
      <div class="editor-layout">
        <div class="desk-preview">
          <label
            >Edit for screen size<select value={device} disabled={saving} onchange={(event) => changeSize(event.currentTarget.value)}
              ><option value="saved" disabled>Design · {viewport.width} × {viewport.height}</option><option value="desktop">Desktop · 1440 × 900</option><option value="wide"
                >Wide desktop · 1920 × 1080</option
              ><option value="tablet">Tablet · 1024 × 768</option><option value="phone"
                >Phone · 360 × 800</option
              ></select
            ></label
          >
          <div class="desk-size" style:--preview-aspect={viewport.width / viewport.height}>
          <WorkspacePreview
            layout={draft.layout}
            {viewport}
            editable={!saving}
            selected={target}
            onselect={(id) => (target = id)}
            onchange={(layout) => draft && (draft.layout = layout)}
          />
          </div>
          <p class="hint">
            {#if compactSurface(viewport)}Drag tools or use the order buttons to arrange them. Set the canvas width and height below.{:else}Drag tools and the canvas to arrange them. Use arrow keys or position fields for precise adjustments.{/if}
            Save to keep this size and arrangement. Duplicate a view to create another size.
            Each device remembers the view you choose here.
          </p>
        </div>
        <aside class="controls" aria-label="View display settings">
          <fieldset disabled={saving} class="display-fields">
            <legend>Display</legend>
            <label
              >Tool display<select bind:value={draft.layout.toolView}
                ><option value="cutouts">Full cutout images</option><option value="grid"
                  >Square buttons</option
                ></select
              ></label
            >
            <label
              >Canvas rotation<select bind:value={draft.layout.rotation}
                ><option value={0}>0°</option><option value={1}>90°</option><option value={2}
                  >180°</option
                ><option value={3}>270°</option></select
              ></label
            >
            {#if !compactSurface(viewport)}<label
              >Placement<select bind:value={draft.layout.dock}
                ><option value="surround">Freeform desk</option><option value="left"
                  >Columns on left</option
                ><option value="right">Columns on right</option><option value="both"
                  >Columns both sides</option
                ></select
              ></label
            >{/if}
            <label
              >Move or size<select bind:value={target}
                ><option value="canvas">Canvas frame</option
                >{#each SUPPLIES.filter( (supply) => draft!.layout.supplies?.includes(supply.id) ) as supply}<option
                    value={supply.id}>{supply.name}</option
                  >{/each}</select
              ></label
            >
            {#if flowing && target !== 'canvas'}<div class="actions">
              <button type="button" onclick={() => reorder(-1)} disabled={draft.layout.order.filter(id => draft!.layout.supplies?.includes(id)).indexOf(target) <= 0}>Move earlier</button>
              <button type="button" onclick={() => reorder(1)} disabled={draft.layout.order.filter(id => draft!.layout.supplies?.includes(id)).at(-1) === target}>Move later</button>
            </div>{/if}
            {#if selectedRect && (!flowing || target === 'canvas')}<div class="numbers">
                {#each ['x', 'y', 'width', 'height'] as field}{#if (target === 'canvas' && (!compactSurface(viewport) || field === 'width' || field === 'height')) || (!flowing && (field === 'x' || field === 'y'))}<label
                      >{field}<input
                        type="number"
                        min="0"
                        step="1"
                        value={Math.round(selectedRect[field as keyof typeof selectedRect])}
                        onchange={(event) =>
                          place(
                            field as 'x' | 'y' | 'width' | 'height',
                            event.currentTarget.valueAsNumber
                          )}
                      /></label
                    >{/if}{/each}
              </div>{/if}
          </fieldset>
          <fieldset disabled={saving}>
            <legend>Tools on the desk</legend>
            {#each SUPPLIES as supply}<label class="tool-switch"
                ><span>{supply.name}</span><input
                  type="checkbox"
                  role="switch"
                  checked={draft.layout.supplies?.includes(supply.id)}
                  onchange={(event) => toggle(supply.id, event.currentTarget.checked)}
                /><span class="switch-track" aria-hidden="true"></span></label
              >{/each}
          </fieldset>
        </aside>
      </div>
    </section>
  {/if}
</div>

<style>
  .manager {
    color: #f5ead7;
    background: #221b14;
    padding: 18px;
    border-radius: 6px;
  }
  .manager-head,
  .actions,
  .edit-head,
  .card-top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .manager-head,
  .card-top {
    justify-content: space-between;
  }
  .manager-head {
    margin-bottom: 12px;
  }
  h2,
  h3,
  p {
    margin: 0 0 8px;
  }
  h2 {
    font-size: 24px;
  }
  h3 {
    font-size: 18px;
    margin-top: 10px;
  }
  p,
  .hint {
    font-size: 13px;
    line-height: 1.5;
  }
  .status:empty {
    display: none;
  }
  button,
  input,
  select {
    min-height: 44px;
    border: 1px solid #aa9874;
    border-radius: 4px;
    padding: 6px 8px;
    color: #fff3de;
    background: #30261b;
    font: inherit;
    font-size: 13px;
  }
  button:disabled {
    opacity: 0.6;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 3px solid #ffee48;
    outline-offset: 2px;
  }
  label {
    display: grid;
    gap: 4px;
    font-size: 13px;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
  }
  .gallery-actions {
    margin-bottom: 16px;
  }
  .view-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: 16px;
    align-content: start;
  }
  article {
    padding: 12px;
    border: 1px solid #857458;
    border-radius: 5px;
    background: #30261b;
    min-width: 0;
  }
  article.active {
    border-color: #f5e64e;
  }
  .preview-link {
    position: relative;
    display: block;
    padding: 0;
    width: 100%;
    border: 0;
    background: transparent;
  }
  .preview-edit {
    position: absolute;
    inset: 0;
    width: 100%;
    border: 0;
    background: transparent;
  }
  .select-all,
  .card-top label {
    display: flex;
    align-items: center;
    min-height: 44px;
    gap: 8px;
  }
  input[type='checkbox'] {
    width: 20px;
    height: 20px;
    min-height: 20px;
    accent-color: #ffee48;
  }
  .card-top {
    font-size: 12px;
  }
  .edit-head {
    margin-bottom: 12px;
  }
  .edit-head > label {
    width: min(100%, 300px);
  }
  .editor-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
    align-items: start;
  }
  .desk-preview {
    position: sticky;
    top: 12px;
    min-width: 0;
  }
  .desk-preview > label {
    margin-bottom: 8px;
  }
  .desk-size {
    width: 100%;
    max-width: calc(65svh * var(--preview-aspect));
    margin-inline: auto;
  }
  .desk-preview .hint {
    color: #e4d7bf;
  }
  .controls {
    display: grid;
    gap: 12px;
    min-width: 0;
    max-height: calc(100svh - 210px);
    overflow: auto;
    padding: 2px 4px;
  }
  .display-fields {
    display: grid;
    gap: 10px;
  }
  .numbers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  fieldset {
    min-width: 0;
    border: 1px solid #857458;
    padding: 10px;
  }
  .tool-switch {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 44px;
    cursor: pointer;
  }
  .tool-switch input {
    position: absolute;
    right: 0;
    opacity: 0;
    width: 44px;
    height: 44px;
    margin: 0;
  }
  .switch-track {
    flex: none;
    width: 38px;
    height: 22px;
    border-radius: 14px;
    background: #5e5344;
    border: 1px solid #d8cbb3;
    pointer-events: none;
  }
  .switch-track::after {
    content: '';
    display: block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin: 2px;
    background: #fff3de;
  }
  .tool-switch input:checked + .switch-track {
    background: #e7cd69;
    border-color: #e7cd69;
  }
  .tool-switch input:checked + .switch-track::after {
    transform: translateX(16px);
    background: #241b0f;
  }
  .tool-switch input:focus-visible + .switch-track {
    outline: 3px solid #ffee48;
    outline-offset: 3px;
  }
  .confirm {
    border: 1px solid #e7b56e;
    padding: 10px;
    margin: 8px 0;
    background: #49321e;
  }
  .rename {
    margin: 8px 0;
  }
  @media (max-width: 800px) {
    .editor-layout {
      grid-template-columns: 1fr;
    }
    .desk-preview {
      position: static;
    }
    .controls {
      max-height: none;
      overflow: visible;
    }
  }
  @media (max-width: 650px) {
    .manager {
      padding: 10px;
    }
  }
</style>
