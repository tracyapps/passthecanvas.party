<script lang="ts">
  import { onMount } from 'svelte';
  import type { SavedWorkspace, WorkspaceLayout, WorkspaceSurface } from './workspaces';
  import type { Toolbox } from './toolboxes';
  import { shownSupplies, findToolbox } from './toolboxes';
  import { SUPPLIES } from './supplies';
  import { workspaceGeometry } from './workspace-geometry';
  import WorkspacePreview from './WorkspacePreview.svelte';

  let {
    views,
    toolboxes,
    current,
    selected = '',
    onupdate,
    onapply,
    onclose,
  }: {
    views: SavedWorkspace[];
    toolboxes: Toolbox[];
    current: WorkspaceLayout;
    selected?: string;
    onupdate: (views: SavedWorkspace[]) => void;
    onapply: (view: SavedWorkspace) => void;
    onclose?: () => void;
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
  let deleting = $state<string | null>(null);
  let note = $state('');
  let nameInput = $state<HTMLInputElement>();
  let dirty = $derived(!!draft && JSON.stringify(draft) !== baseline);
  let viewport = $derived(
    device === 'phone'
      ? { ...desktop, width: 360, height: 800, headerHeight: 160 }
      : device === 'tablet'
        ? { ...desktop, width: 1024, height: 768, headerHeight: 120 }
        : device === 'wide'
          ? { ...desktop, width: 1920, height: 1080 }
          : (draft?.layout.surface ?? desktop)
  );
  let selectedRect = $derived(
    draft
      ? target === 'canvas'
        ? workspaceGeometry(draft.layout, draft.layout.surface ?? desktop).frame
        : workspaceGeometry(draft.layout, draft.layout.surface ?? desktop).boxes[target]
      : undefined
  );

  function resolved(layout: WorkspaceLayout): WorkspaceLayout {
    const copy = structuredClone($state.snapshot(layout));
    copy.toolView ??= 'cutouts';
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
      deleting = null;
      note = '';
      queueMicrotask(() => nameInput?.focus());
    });
  }
  function newView() {
    if (views.length >= 30) {
      note = 'Up to 30 saved views.';
      return;
    }
    edit({ id: crypto.randomUUID(), name: 'New view', layout: current });
    // New views use the current arrangement. The name can be changed before saving.
  }
  function save(apply = false) {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      note = 'Give this view a name.';
      nameInput?.focus();
      return;
    }
    if (
      views.some(
        (view) => view.id !== draft?.id && view.name.trim().toLowerCase() === name.toLowerCase()
      )
    ) {
      note = 'A view with that name already exists. Choose another name.';
      return;
    }
    if (!views.some((view) => view.id === draft?.id) && views.length >= 30) {
      note = 'Up to 30 saved views.';
      return;
    }
    const saved = structuredClone($state.snapshot({ ...draft, name }));
    onupdate(
      views.some((view) => view.id === saved.id)
        ? views.map((view) => (view.id === saved.id ? saved : view))
        : [...views, saved]
    );
    draft = saved;
    baseline = JSON.stringify(saved);
    note = `${name} saved.`;
    if (apply) onapply(saved);
  }
  function remove(view: SavedWorkspace) {
    guard(() => {
      onupdate(views.filter((item) => item.id !== view.id));
      if (draft?.id === view.id) {
        draft = null;
        baseline = '';
      }
      deleting = null;
      note = `${view.name} deleted. Your current painting stays open.`;
    });
  }
  function toggle(id: string, enabled: boolean) {
    if (!draft) return;
    const ids = new Set(draft.layout.supplies);
    if (enabled) ids.add(id);
    else ids.delete(id);
    draft.layout = { ...draft.layout, supplies: draft.layout.order.filter((id) => ids.has(id)) };
  }
  function reorder(id: string, offset: number) {
    if (!draft) return;
    const order = [...draft.layout.order],
      index = order.indexOf(id);
    if (index < 0 || index + offset < 0 || index + offset >= order.length) return;
    order.splice(index, 1);
    order.splice(index + offset, 0, id);
    draft.layout = { ...draft.layout, order };
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
              ? (surface.headerHeight + surface.toolbarHeight + 16) / surface.height
              : 0,
        Math.min(1, value / (field === 'x' || field === 'width' ? surface.width : surface.height))
      );
      draft.layout = { ...draft.layout, frame };
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
      save();
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

<div class="manager" role="group" aria-label="Saved view manager">
  <header class="manager-head">
    <div>
      <h2>Saved views</h2>
      <p>Save your tools, display style, order and canvas frame as one arrangement.</p>
    </div>
    {#if onclose}<button type="button" onclick={() => guard(onclose!)}>Close views</button>{/if}
  </header>
  <div class="manager-actions">
    <button type="button" onclick={newView}>Save current as new view</button>
    <p role="status">{note}</p>
  </div>
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
      ><button type="button" onclick={() => (pending = null)}>Keep editing</button>
    </div>{/if}
  {#if deleting}
    {@const deletingView = views.find((view) => view.id === deleting) ?? draft}
    {#if deletingView}<div class="confirm" role="alert">
        <p>Delete “{deletingView.name}”?</p>
        <button type="button" onclick={() => remove(deletingView)}>Delete view</button><button
          type="button"
          onclick={() => (deleting = null)}>Keep view</button
        >
      </div>{/if}
  {/if}
  <div class="manager-layout" class:editing={!!draft}>
    <section class="view-cards" aria-label="Saved view previews">
      {#each views as view (view.id)}
        <article class:active={selected === view.id}>
          <WorkspacePreview
            layout={resolved(view.layout)}
            viewport={view.layout.surface ?? desktop}
          />
          <h3>{view.name}</h3>
          <p>
            {view.layout.toolView === 'grid'
              ? 'Grid'
              : view.layout.toolView === 'tray'
                ? 'Toolbox tray'
                : 'Cutout tools'}
          </p>
          <div class="card-actions">
            <button
              type="button"
              aria-label={`Apply ${view.name}`}
              onclick={() => guard(() => onapply(view))}>Use view</button
            >
            <button type="button" aria-label={`Edit ${view.name}`} onclick={() => edit(view)}
              >Edit</button
            >
            <button type="button" aria-label={`Rename ${view.name}`} onclick={() => edit(view)}
              >Rename</button
            >
            <button
              type="button"
              aria-label={`Duplicate ${view.name}`}
              onclick={() => edit(view, true)}>Duplicate</button
            >
            <button
              type="button"
              aria-label={`Delete ${view.name}`}
              onclick={() => (deleting = view.id)}>Delete</button
            >
          </div>
        </article>
      {:else}<p>No saved views yet. Start with your current arrangement.</p>{/each}
    </section>
    {#if draft}
      <section class="editor" aria-label="Edit saved view">
        <header>
          <label
            >View name<input bind:this={nameInput} maxlength="80" bind:value={draft.name} /></label
          ><span>{dirty ? 'Unsaved edits' : 'Saved'}</span>
        </header>
        <div class="edit-actions">
          <button type="button" onclick={() => save()}>Save changes</button><button
            type="button"
            onclick={() => save(true)}>Save & use</button
          >
          <button
            type="button"
            onclick={() => {
              if (draft) {
                draft = {
                  ...structuredClone($state.snapshot(draft)),
                  id: crypto.randomUUID(),
                  name: `${draft.name.slice(0, 70)} copy`,
                };
                baseline = '';
              }
            }}>Duplicate</button
          ><button type="button" onclick={() => (deleting = draft!.id)}>Delete</button>
          <button
            type="button"
            onclick={() =>
              guard(() => {
                draft = null;
                baseline = '';
              })}>Cancel editing</button
          >
        </div>

        <div class="editor-layout">
          <div>
            <label
              >Device preview<select bind:value={device}
                ><option value="saved">Saved design size</option><option value="wide"
                  >Wide desktop · 1920 × 1080</option
                ><option value="tablet">Tablet · 1024 × 768</option><option value="phone"
                  >Phone · 360 × 800</option
                ></select
              ></label
            >
            <WorkspacePreview
              layout={draft.layout}
              {viewport}
              editable={device === 'saved'}
              selected={target}
              onselect={(id) => (target = id)}
              onchange={(layout) => draft && (draft.layout = layout)}
            />
            <p class="hint">
              Drag a tool or the canvas in the desktop preview. Freeform dragging positions tools;
              dragging in columns reorders them. Arrow keys move the selected freeform item. Device
              previews show responsive tool placement. Party controls and floating panels are
              omitted.
            </p>
          </div>
          <aside class="controls" aria-label="View display settings">
            <label
              >Tool display<select
                value={draft.layout.toolView}
                onchange={(event) =>
                  draft &&
                  (draft.layout.toolView = event.currentTarget
                    .value as WorkspaceLayout['toolView'])}
                ><option value="cutouts">Full cutout images</option><option value="grid"
                  >Grid buttons</option
                ><option value="tray">Toolbox windows</option></select
              ></label
            >
            <label
              >Canvas rotation<select bind:value={draft.layout.rotation}
                ><option value={0}>0°</option><option value={1}>90°</option><option value={2}
                  >180°</option
                ><option value={3}>270°</option></select
              ></label
            >
            <label
              >Placement<select bind:value={draft.layout.dock}
                ><option value="surround">Freeform desk</option><option value="left"
                  >Columns on left</option
                ><option value="right">Columns on right</option><option value="both"
                  >Columns both sides</option
                ></select
              ></label
            >
            <label
              >Move or size<select bind:value={target}
                ><option value="canvas">Canvas frame</option
                >{#each SUPPLIES.filter( (supply) => draft!.layout.supplies?.includes(supply.id) ) as supply}<option
                    value={supply.id}>{supply.name}</option
                  >{/each}</select
              ></label
            >
            {#if selectedRect}<div class="numbers">
                {#each ['x', 'y', 'width', 'height'] as field}{#if target === 'canvas' || field === 'x' || field === 'y'}<label
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
            <fieldset>
              <legend>Tools and display order</legend
              >{#each draft.layout.order as id}{@const supply = SUPPLIES.find(
                  (supply) => supply.id === id
                )}{#if supply}<div class="tool-choice">
                    <label
                      ><input
                        type="checkbox"
                        checked={draft.layout.supplies?.includes(id)}
                        onchange={(event) => toggle(id, event.currentTarget.checked)}
                      />{supply.name}</label
                    ><button
                      type="button"
                      aria-label={`Move ${supply.name} earlier`}
                      onclick={() => reorder(id, -1)}>↑</button
                    ><button
                      type="button"
                      aria-label={`Move ${supply.name} later`}
                      onclick={() => reorder(id, 1)}>↓</button
                    >
                  </div>{/if}{/each}
            </fieldset>
          </aside>
        </div>
      </section>
    {/if}
  </div>
</div>

<style>
  .manager {
    color: #f5ead7;
    background: #221b14;
    padding: 18px;
    border-radius: 6px;
  }
  .manager-head,
  .manager-actions,
  .editor > header,
  .card-actions,
  .edit-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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
    font-size: 17px;
    margin-top: 8px;
  }
  p,
  .hint {
    font-size: 13px;
    line-height: 1.5;
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
  .view-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 12px;
    align-content: start;
  }
  article {
    padding: 10px;
    border: 1px solid #857458;
    border-radius: 5px;
    background: #30261b;
    min-width: 0;
  }
  article.active {
    border-color: #f5e64e;
  }
  .card-actions,
  .edit-actions {
    justify-content: flex-start;
  }
  .manager-layout.editing {
    display: grid;
    grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
    gap: 16px;
  }
  .editing .view-cards {
    grid-template-columns: 1fr;
    max-height: 70svh;
    overflow: auto;
  }
  .editor {
    min-width: 0;
  }
  .editor > header {
    align-items: end;
    margin-bottom: 8px;
  }
  .editor-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 230px;
    gap: 12px;
    margin-top: 12px;
  }
  .editor-layout > div,
  .controls {
    min-width: 0;
  }
  .controls {
    display: grid;
    align-content: start;
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
    padding: 6px;
  }
  .tool-choice {
    display: flex;
    gap: 3px;
    align-items: center;
    margin-bottom: 4px;
  }
  .tool-choice label {
    display: flex;
    align-items: center;
    flex: 1;
  }
  .tool-choice input {
    width: 18px;
    min-height: 18px;
  }
  .tool-choice button {
    min-width: 44px;
  }
  .confirm {
    border: 1px solid #e7b56e;
    padding: 10px;
    margin: 8px 0;
    background: #49321e;
  }
  @media (max-width: 1000px) {
    .manager-layout.editing {
      grid-template-columns: 1fr;
    }
    .editing .view-cards {
      max-height: 240px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
  }
  @media (max-width: 650px) {
    .editor-layout {
      grid-template-columns: 1fr;
    }
    .manager {
      padding: 10px;
    }
  }
</style>
