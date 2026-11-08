<!--
  The party's painting table: photographic supplies around the shared canvas,
  movable tool/palette panels and saved layouts.
  Everyone sees the same canvas; only the current painter can mark it. While
  you wait, you can still pick up tools, load paint and arrange your table.
  The parent (Studio) wires it to the party: strokes out via `onstroke`,
  everyone else's strokes in via `applyRemote`.
-->
<script lang="ts">
  import { onMount, tick, untrack, type Snippet } from 'svelte';
  import type { PaintedStroke, Stroke } from '@ptc/shared';
  import AccountControls from '../account/AccountControls.svelte';
  import { accountState, loadAccountWorkspaces, saveAccountWorkspaces } from '../account/account.svelte';
  import { SUPPLIES as supplies, supplyAsset as asset, supplyImage as imageForSupply } from './supplies';
  import PhotoSupply from './PhotoSupply.svelte';
  import StudioPanel from './StudioPanel.svelte';
  import WorkspaceManager from './WorkspaceManager.svelte';
  import WorkspaceDrawer from './WorkspaceDrawer.svelte';
  import { workspaceGeometry } from './workspace-geometry';
  import PartyCanvas from './PartyCanvas.svelte';
  import { addPart, decodeMixes, expand, mixColor, recipeText, rememberMix, removeColor, removePart, totalParts, MAX_PARTS, SAVED_MIXES_KEY, type Recipe, type SavedMix } from './recipes';
  import { prefs, savePreferences } from '../prefs.svelte';
  import { colorLibrary } from './color-library';
  import { PALETTES } from './palettes';
  import { EVERYTHING, findToolbox, shownSupplies, type Toolbox } from './toolboxes';
  import { defaultLayout, decodeWorkspaces, layoutMatches, workspaceForDevice, WORKSPACE_KEY, type WorkspaceLayout, type SavedWorkspace, type ToolDock, type WorkspaceSurface } from './workspaces';
  import { type SupplyRect } from './placement';
  import { buildMask, maskHit, type ShapeMask } from './shape-masks';
  import { emptySelection, selectTool, loadPaint, dipInWater, isBrush, takesWater, unavailability,
    TOOL_NAMES, MEDIUM_NAMES, type PaintingTool, type PaintingMedium, type PaintLoad } from './painting-selection';
  interface Props {
    canDraw: boolean;
    /** Your party member id; with `round` it names your turn's layer. */
    painterId: string;
    round: number;
    /** Which canvas is on the table ("c1"…, or "lobby"). */
    canvasKey: string;
    canvasSize: { width: number; height: number };
    /** Spoken canvas summary, e.g. "Round 2 of 4. Jordan is painting." */
    label: string;
    /** Shown while it isn't your turn, e.g. "Watching Jordan paint." */
    waitingNote: string;
    onstroke: (stroke: Stroke) => void;
    /** Party controls for the top bar: round, timer, start, pass. */
    partyBar?: Snippet;
    /** Extra items for the table menu (host tools, guests, room). */
    menu?: Snippet;
    /** Account and site links (my studio, practice pieces), kept apart from the tools. */
    utility?: Snippet;
    /** A short message from the page (saved, downloaded…), shown in the header for a few seconds. */
    notice?: string;
    /** A tiny save state shown by the menu ("Unsaved changes", "Auto-saved 10:42"). */
    saveStatus?: string;
    /** clean | unsaved | saving | autosaving | error: colors the indicator's dot. */
    saveState?: string;
    /** Cmd/Ctrl+S. */
    onsave?: () => void;
  }
  let { canDraw, painterId, round, canvasKey, canvasSize, label, waitingNote, onstroke, partyBar, menu, utility, notice = '', saveStatus = '', saveState = 'clean', onsave }: Props = $props();
  let canvas = $state<PartyCanvas>();
  export function applyRemote(stroke: PaintedStroke) { canvas?.applyRemote(stroke); }
  export async function loadHistory(key: string, width: number, height: number, strokes: PaintedStroke[], complete: boolean, baseUrl: string | null, ownBase = false) { await canvas?.loadHistory(key, width, height, strokes, complete, baseUrl, ownBase); }
  export function snapshot(paintOnly = false): string { return canvas?.snapshot(paintOnly) ?? ''; }
  export function snapshotBlob(paintOnly = false): Promise<Blob> { return canvas ? canvas.snapshotBlob(paintOnly) : Promise.reject(new Error('No canvas yet.')); }
  export function loadPicture(key: string, width: number, height: number, picture: CanvasImageSource, strokes: PaintedStroke[]) { canvas?.loadPicture(key, width, height, picture, strokes); }
  export function finishStroke() { canvas?.finishStroke(); }
  export function busy(): boolean { return canvas?.busy() ?? false; }
  export function strokes(): PaintedStroke[] { return canvas?.strokes() ?? []; }

  let bench: HTMLElement;
  let statusStrip: HTMLElement;
  let headerHeight = $state(88);
  let dock = $state<ToolDock>('surround');
  let gridView = $derived(prefs.toolView === 'grid');
  // Layout placement is shared by cutouts and freeform grid tiles.
  let toolDock = $derived(dock);
  async function setToolView(view: 'cutouts' | 'grid') {
    try { await savePreferences({ toolView: view }); }
    catch { announcement = 'Tool view changed here. Account sync failed.'; }
  }
  function supplyImage(id: string, small = false): string { return imageForSupply(id, small ? 'grid' : 'cutouts'); }
  let rotation = $state(0);
  let viewReset = $state(0);
  let toolbarHeight = $state(110);
  /** Saved canvas frame in design pixels. Null uses the default for this screen. */
  let frameOverride = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let documentSize = $derived(canvasSize);
  let savedViews = $state<SavedWorkspace[]>([]);
  // Toolboxes: which supplies are on the table (see toolboxes.ts). Saved with your views.
  let customToolboxes = $state<Toolbox[]>([]);
  let toolbox = $state(EVERYTHING);
  let order = $state(supplies.map(supply => supply.id));
  let activeBox = $derived(findToolbox(toolbox, customToolboxes));
  let viewsOpen = $state(false);
  let selectedView = $state('');
  let activeViewValue = $derived.by(() => {
    const saved = savedViews.find(view => view.id === selectedView);
    if (!saved) return '';
    const current = currentLayout();
    return layoutMatches(saved.layout, current) ? selectedView : '';
  });

  let storageReady = $state(false);
  let storageError = $state('');
  let accountLoadedFor = $state<string | null | undefined>();
  let accountSyncing = $state(false);
  let cloudEnabled = $state(false);
  let cloudLoaded = $state(false);
  // ---- Is the table itself saved? (toolboxes, supply positions, views, canvas window) ----
  // Always kept on this device straight away. Signed in, it also auto-saves to
  // your account a couple of seconds after you stop changing it, or now with "Save table".
  let layoutSavedJson = $state('');
  let layoutSavedAt = $state<Date | null>(null);
  let layoutSaving = $state(false);
  let layoutError = $state(false);
  let layoutNow = $state(Date.now());
  let layoutJson = $derived(JSON.stringify(workspaceState()));
  let layoutState = $derived(!accountState.userId ? 'local' : layoutSaving ? 'saving' : layoutError ? 'error' : !cloudLoaded ? 'loading' : layoutJson !== layoutSavedJson ? 'unsaved' : 'saved');
  let layoutStatus = $derived(({
    local: 'Table kept on this device (sign in to keep it everywhere)',
    saving: 'Saving the table…',
    error: 'Table not saved to your account: check your connection',
    loading: 'Opening your account’s table…',
    unsaved: 'Table changes not saved yet',
    saved: layoutSavedAt ? `Table saved ${Math.max(0, layoutNow - layoutSavedAt.getTime()) < 45_000 ? 'just now' : layoutNow - layoutSavedAt.getTime() < 3_600_000 ? `${Math.round((layoutNow - layoutSavedAt.getTime()) / 60_000)} min ago` : layoutSavedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Table saved to your account'
  } as Record<string, string>)[layoutState]);
  let accountMessage = $state('');
  let cloudQueue = Promise.resolve();
  let board = $state({ width: 1440, height: 1024 });
  let windowWidth = $state(innerWidth);
  let windowHeight = $state(innerHeight);
  let compact = $derived(windowWidth <= 1100 || windowHeight <= 720 || windowWidth / windowHeight < 1.35);
  let selection = $state(emptySelection());
  let size = $state(24);
  let intensities = $state({ airbrush: 50, burnisher: 50 });
  let hasIntensity = $derived(selection.tool === 'airbrush' || selection.tool === 'burnisher');
  let intensity = $derived(selection.tool === 'airbrush' || selection.tool === 'burnisher' ? intensities[selection.tool] : 50);
  let wheelZoom = $state(false);
  let settingsOpen = $state(true);
  let paletteOpen = $state(false);
  let paletteMedium = $state<PaintingMedium>('acrylic');
  let trayOpen = $state(false);
  // The tray holds a recipe (colors + parts). `dabs` is every part, in order.
  let recipe = $state<Recipe>([]);
  let dabs = $derived(expand(recipe));
  let savedMixes = $state<SavedMix[]>([]);
  let trayMode = $state<'solid' | 'multicolor'>('multicolor');
  let trayMedium = $state<'acrylic' | 'watercolor'>('acrylic');
  let announcement = $state('');
  let layoutSurface = $state<WorkspaceSurface>();
  let viewSupplies = $state<string[] | null>(null);
  let positions = $state<Record<string, { x: number; y: number }>>({});
  let toolName = $derived(selection.tool ? TOOL_NAMES[selection.tool] : 'None');
  let status = $derived(!canDraw ? `${waitingNote} Get your tools ready while you wait.`
    : !selection.tool ? 'Choose a tool to begin. Drag the canvas (or hold Space) to move around.'
    : selection.tool === 'burnisher' ? 'Smudge & intensify. Only your own turn will change.'
    : selection.tool === 'sponge' && selection.wet ? 'Wet sponge: pushes paint around in runny, textured patches.'
    : selection.tool === 'eraser' || selection.tool === 'sponge' ? 'Ready. Only your own turn will change.'
    : selection.load ? `${selection.load.name}${selection.wet ? ', with water' : ''}. Ready to paint.`
    : selection.wet ? 'Water only: paint you brush over runs and smears. Only your own turn will change.' : 'Choose a compatible paint to load your tool.');
  let trayReason = $derived(unavailability(selection.tool, trayMedium));
  let solidColor = $derived(mixColor(recipe));
  let paletteId = $state('');
  let paletteLibrary = $derived(colorLibrary(prefs.colorPalettes));
  let visiblePalettes = $derived(paletteLibrary.filter((palette) => !palette.hidden)
    .sort((a, b) => Number(b.favorite) - Number(a.favorite)));
  let selectedPalette = $derived(paletteLibrary.find((palette) => palette.id === paletteId));
  let availableColors = $derived(selectedPalette?.colors ?? PALETTES[trayOpen ? trayMedium : paletteMedium]);
  // The default canvas window depends only on the screen, the tool dock and the
  // canvas shape. Palettes and settings panels float above it, so opening one
  // never moves the canvas or the supplies.
  let liveSurface = $derived({ width: board.width, height: windowHeight, headerHeight, toolbarHeight });
  let geometry = $derived(workspaceGeometry({ ...currentLayout(), surface: layoutSurface }, liveSurface, documentSize.width / documentSize.height));
  let canvasBox = $derived(geometry.frame);
  let frameRect = $derived(geometry.frame);
  onMount(() => {
    const measureBoard = () => {
      // Switching to the room hides this desk. Keep its last real dimensions.
      if (bench.clientWidth > 0 && bench.clientHeight > 0) board = { width: bench.clientWidth, height: bench.clientHeight };
    };
    const measureHeader = () => {
      const height = statusStrip.getBoundingClientRect().height;
      if (height > 0) headerHeight = height;
    };
    measureBoard();
    measureHeader();
    const observer = new ResizeObserver(measureBoard);
    observer.observe(bench);
    const headerObserver = new ResizeObserver(measureHeader);
    headerObserver.observe(statusStrip);
    readMixes();
    const syncViews = (event: StorageEvent) => {
      if (event.key !== browserKey(accountState.userId) || !event.newValue) return;
      try {
        const stored = decodeWorkspaces(event.newValue, supplies.map(supply => supply.id));
        savedViews = stored.views;
        if (stored.selected !== selectedView) { applyLayout(stored.current); selectedView = stored.selected; }
      } catch { /* keep the open desk when external storage is invalid */ }
    };
    window.addEventListener('storage', syncViews);
    const unlockZoom = lockPageZoom();
    const layoutClock = setInterval(() => (layoutNow = Date.now()), 15_000);
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw) { const stored = decodeWorkspaces(raw, supplies.map(item => item.id)); savedViews = stored.views; selectedView = stored.selected; customToolboxes = stored.toolboxes ?? []; applyLayout(stored.current); }
    } catch { storageError = 'Saved views could not be read. Existing browser data has been kept.'; }
    storageReady = true;
    return () => { observer.disconnect(); headerObserver.disconnect(); unlockZoom(); clearInterval(layoutClock); window.removeEventListener('storage', syncViews); };
  });
  function currentLayout(): WorkspaceLayout {
    const surface = layoutSurface ?? { width: board.width, height: Math.max(windowHeight, headerHeight + 1), headerHeight, toolbarHeight };
    return {
      positions: $state.snapshot(positions), order: [...order], dock,
      frame: frameOverride ? { x: frameOverride.x / surface.width, y: frameOverride.y / surface.height, width: frameOverride.width / surface.width, height: frameOverride.height / surface.height } : null,
      rotation, toolbox, toolView: gridView ? 'grid' : 'cutouts', supplies: [...shown], surface
    };
  }
  function applyLayout(layout: WorkspaceLayout) {
    positions = $state.snapshot(layout.positions);
    order = [...layout.order]; dock = layout.dock; rotation = layout.rotation; toolbox = layout.toolbox ?? EVERYTHING;
    viewSupplies = layout.supplies ? [...layout.supplies] : null;
    layoutSurface = layout.surface ? { ...layout.surface } : undefined;
    if (layout.toolView) void setToolView(layout.toolView === 'grid' ? 'grid' : 'cutouts');
    const width = layout.surface?.width ?? windowWidth, height = layout.surface?.height ?? windowHeight;
    if (layout.frame) {
      const fallback = workspaceGeometry({ ...layout, surface: undefined }, { width, height, headerHeight: layout.surface?.headerHeight ?? headerHeight, toolbarHeight: layout.surface?.toolbarHeight ?? toolbarHeight }, documentSize.width / documentSize.height).frame;
      frameOverride = { x: layout.frame.x === undefined ? fallback.x : layout.frame.x * width, y: layout.frame.y === undefined ? fallback.y : layout.frame.y * height, width: layout.frame.width * width, height: layout.frame.height * height };
    } else frameOverride = null;
    viewReset += 1;
  }
  $effect(() => {
    const state = { version: 1, current: currentLayout(), views: $state.snapshot(savedViews), selected: selectedView, toolboxes: $state.snapshot(customToolboxes) };
    if (!storageReady || storageError || !accountState.ready || accountSyncing || accountLoadedFor !== accountState.userId) return;
    try { localStorage.setItem(browserKey(accountState.userId), JSON.stringify(state)); }
    catch { storageError = 'This browser could not save the layout. Your current view is still usable.'; }
  });
  function browserKey(userId: string | null) { return userId ? `${WORKSPACE_KEY}:${userId}` : WORKSPACE_KEY; }
  function workspaceState() { return { version: 1, current: currentLayout(), views: $state.snapshot(savedViews), selected: selectedView, toolboxes: $state.snapshot(customToolboxes) }; }
  function restoreWorkspace(value: unknown) {
    const stored = decodeWorkspaces(JSON.stringify(value), supplies.map(item => item.id));
    savedViews = stored.views; selectedView = stored.selected; customToolboxes = stored.toolboxes ?? []; applyLayout(stored.current);
  }
  async function restoreAccount(userId: string | null) {
    accountSyncing = true; cloudEnabled = false; cloudLoaded = false; storageError = ''; accountMessage = '';
    savedViews = []; selectedView = ''; customToolboxes = []; applyLayout(defaultLayout(supplies.map(item => item.id)));
    try {
      const raw = localStorage.getItem(browserKey(userId));
      if (raw) restoreWorkspace(JSON.parse(raw));
      else { savedViews = []; selectedView = ''; applyLayout(defaultLayout(supplies.map(item => item.id))); }
    } catch { storageError = 'Browser views could not be read. Existing data has been kept.'; }
    if (!userId) { accountSyncing = false; return; }
    try {
      const remote = await loadAccountWorkspaces();
      if (accountState.userId !== userId) return;
      if (remote !== null) {
        const account = decodeWorkspaces(JSON.stringify(remote), supplies.map(item => item.id));
        const local = localStorage.getItem(browserKey(userId));
        restoreWorkspace(workspaceForDevice(account, local ? decodeWorkspaces(local, supplies.map(item => item.id)) : undefined));
        accountMessage = 'Account views restored. Changes to this arrangement save automatically.';
      }
      else accountMessage = 'Your table will be saved to your account as you change it.';
      cloudLoaded = true;
      cloudEnabled = true;
      layoutError = false;
      // What the account holds now; any difference shows as "not saved yet" and auto-saves.
      await tick();
      layoutSavedJson = remote !== null ? JSON.stringify(workspaceState()) : '';
      layoutSavedAt = remote !== null ? new Date() : null;
    } catch (error) { if (accountState.userId === userId) { accountMessage = error instanceof Error ? error.message : 'Account views could not be loaded.'; layoutError = true; } }
    finally { if (accountState.userId === userId) accountSyncing = false; }
  }
  $effect(() => {
    if (!storageReady || !accountState.ready || accountLoadedFor === accountState.userId) return;
    accountLoadedFor = accountState.userId;
    void restoreAccount(accountState.userId);
  });
  async function saveCloud(value = workspaceState(), reportFailure = false) {
    const userId = accountState.userId;
    if (!userId || accountSyncing) return;
    if (!cloudLoaded) { accountMessage = 'Load account views successfully before saving changes to the account.'; return; }
    layoutSaving = true;
    const save = cloudQueue.then(async () => {
      if (accountState.userId !== userId) throw new Error('The signed-in account changed. Try again.');
      await saveAccountWorkspaces(value, userId);
      if (accountState.userId === userId) { cloudEnabled = true; layoutError = false; layoutSavedJson = JSON.stringify(value); layoutSavedAt = new Date(); layoutNow = Date.now(); accountMessage = 'Saved to your account.'; }
    });
    cloudQueue = save.catch(() => {});
    try { await save; } catch (error) { if (accountState.userId === userId) { layoutError = true; accountMessage = error instanceof Error ? error.message : 'Account save failed. Your edits are still here.'; } if (reportFailure) throw error; }
    finally { layoutSaving = false; }
  }
  $effect(() => {
    const value = workspaceState();
    if (!cloudEnabled || !accountState.userId || accountSyncing || !storageReady || JSON.stringify(value) === untrack(() => layoutSavedJson)) return;
    // Wait for a pause before saving the table to your account.
    const timer = setTimeout(() => void saveCloud(value), 2000);
    return () => clearTimeout(timer);
  });
  function resetView() {
    applyLayout({ ...defaultLayout(supplies.map(supply => supply.id)), toolView: 'cutouts' });
    selectedView = '';
    announcement = 'Default view restored, including the canvas and all tool positions.';
  }
  // Saving a named view is one action. Account saves complete before reporting success.
  async function updateViews(views: SavedWorkspace[]) {
    if (accountState.userId) {
      if (!cloudLoaded || accountSyncing) throw new Error('Account views are unavailable. Your edits are still here. Try again after reconnecting.');
      const value = { ...workspaceState(), views: $state.snapshot(views), selected: views.some(view => view.id === selectedView) ? selectedView : '' };
      await saveCloud(value, true);
    }
    savedViews = views;
    if (!views.some(view => view.id === selectedView)) selectedView = '';
    localStorage.setItem(browserKey(accountState.userId), JSON.stringify(workspaceState()));
  }
  async function saveSelectedView() {
    const view = savedViews.find(view => view.id === selectedView);
    if (!view) return;
    try {
      await updateViews(savedViews.map(item => item.id === view.id ? { ...item, layout: currentLayout() } : item));
      announcement = accountState.userId ? `${view.name} saved to your account.` : `${view.name} saved on this device.`;
    } catch (error) { announcement = error instanceof Error ? error.message : 'View save failed. Try again.'; }
  }
  function openViews() {
    document.getElementById('table-actions')?.hidePopover();
    document.getElementById('view-options')?.hidePopover();
    viewsOpen = true;
  }
  function loadView(id: string) { if (!id) { resetView(); return; } const view = savedViews.find(item => item.id === id); if (view) { applyLayout(view.layout); selectedView = id; announcement = `${view.name} restored.`; } }
  function putDown() {
    selection = { ...selection, tool: null, load: null, wet: false };
    paletteOpen = false;
    announcement = 'Tool put down. The artwork is unchanged.';
  }
  function globalKey(event: KeyboardEvent) {
    if (viewsOpen) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && onsave) { event.preventDefault(); onsave(); return; }
    if (event.key !== 'Escape') return;
    putDown();
  }
  /**
   * On the painting table, pinching and double-tapping move the canvas, never
   * the page: a pinch outside the canvas, a trackpad pinch over the controls or
   * focusing a small text field must not zoom the interface. Keyboard zoom
   * (Cmd/Ctrl +) still works, and Settings has an interface size for bigger controls.
   */
  function lockPageZoom(): () => void {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const before = meta?.content;
    if (meta) meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    const onCanvas = (target: EventTarget | null) => target instanceof Element && !!target.closest('.viewport');
    const gesture = (event: Event) => event.preventDefault(); // Safari's page pinch
    const touch = (event: TouchEvent) => { if (event.touches.length > 1 && !onCanvas(event.target)) event.preventDefault(); };
    const wheel = (event: WheelEvent) => { if (event.ctrlKey && !onCanvas(event.target)) event.preventDefault(); }; // trackpad pinch
    document.addEventListener('gesturestart', gesture);
    document.addEventListener('gesturechange', gesture);
    document.addEventListener('touchmove', touch, { passive: false });
    window.addEventListener('wheel', wheel, { passive: false });
    return () => {
      if (meta && before !== undefined) meta.content = before;
      document.removeEventListener('gesturestart', gesture);
      document.removeEventListener('gesturechange', gesture);
      document.removeEventListener('touchmove', touch);
      window.removeEventListener('wheel', wheel);
    };
  }
  function emptySpace(event: MouseEvent) {
    if (event.target !== bench) return;
    // A click on the tabletop picks up whatever supply's shape is under it, or puts the tool down.
    const supply = supplyAt(event.clientX, event.clientY);
    if (supply) void openSupply(supply); else putDown();
  }

  // ---- Picking supplies by their shape ----
  // On the full table, supply buttons don't take pointer events; the table
  // hit-tests each photo's outline instead (shape-masks.ts). Tiles (phones,
  // docked columns) are plain rectangles, so they keep normal buttons.
  let masked = $derived(!compact && !gridView && toolDock === 'surround');
  const masks: Record<string, ShapeMask | null> = {};
  let masksStarted = false;
  $effect(() => {
    if (masked && !masksStarted) {
      masksStarted = true;
      void loadMasks();
    }
  });
  let hoverId = $state<string | null>(null);
  async function loadMasks() {
    for (const supply of supplies) {
      const url = supplyImage(supply.id);
      masks[supply.id] = await buildMask(url, supply.box[2]! / supply.box[3]!);
    }
  }
  /** Stacking on the table: what's drawn on top is picked first. */
  function layerOf(id: string): number { return active(id) ? 4 : id === 'burnisher' ? 3 : 2; }
  function supplyAt(clientX: number, clientY: number): typeof supplies[number] | null {
    if (!masked) return null;
    const table = bench.getBoundingClientRect();
    const x = clientX - table.left, y = clientY - table.top;
    const candidates = shown.map((id, index) => ({ supply: supplies.find(item => item.id === id)!, index }))
      .sort((a, b) => layerOf(b.supply.id) - layerOf(a.supply.id) || b.index - a.index);
    for (const { supply } of candidates) {
      const box = supplyBox(supply);
      const u = (x - box.x) / box.width, v = (y - box.y) / box.height;
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const mask = masks[supply.id];
      if (mask ? maskHit(mask, u, v) : true) return supply;
    }
    return null;
  }
  function tablePointerMove(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return;
    hoverId = event.target === bench ? supplyAt(event.clientX, event.clientY)?.id ?? null : null;
  }
  function select(tool: PaintingTool) {
    selection = selectTool(selection, tool);
    settingsOpen = true;
    // An open palette stays open between tools. If the new tool can't use it
    // (airbrush with watercolor, say), switch to a set it can use instead of
    // showing a grid of colors that can't be picked.
    if (paletteOpen && !trayOpen && unavailability(tool, paletteMedium)) {
      const usable = (['acrylic', 'watercolor', 'pastel', 'charcoal', 'pencil'] as PaintingMedium[]).find(medium => !unavailability(tool, medium));
      if (usable) paletteMedium = usable;
    }
    if (paletteOpen && trayOpen && unavailability(tool, trayMedium) && !unavailability(tool, trayMedium === 'acrylic' ? 'watercolor' : 'acrylic')) trayMedium = trayMedium === 'acrylic' ? 'watercolor' : 'acrylic';
    announcement = `${TOOL_NAMES[tool]}. ${status}`;
  }
  function active(id: string): boolean {
    // Water lights up only while the tool carries just water (after a rinse), never alongside a paint box.
    if (id === 'water') return selection.wet && !selection.load;
    // The paint boxes light up for the palette you're looking at, not only the paint already on the brush.
    if (id === 'acrylic' || id === 'watercolor') return paletteOpen && !trayOpen ? paletteMedium === id : selection.load?.medium === id;
    if (id === 'tray' && paletteOpen && trayOpen) return true;
    if (id === 'tray') return selection.load?.name.startsWith('Tray:') ?? false;
    return selection.tool === id || selection.load?.medium === id;
  }
  async function revealPalette() {
    if (!compact) return;
    await tick();
    // Flowing phone/tablet controls can be above the selected supply. Bring the
    // chooser into view without trapping focus or opening a modal.
    document.querySelector<HTMLButtonElement>('[aria-label="Move color palette. Drag or use arrow keys."]')?.focus();
  }
  async function openSupply(supply: typeof supplies[number]) {
    if (supply.id === 'water') { rinse(); return; }
    if (supply.id === 'tray') { trayOpen = true; paletteOpen = true; await revealPalette(); return; }
    if (supply.tool) select(supply.tool);
    if (!supply.medium) { if (compact) await showSettings(); return; }
    // Reaching for a paint box with no brush (or one that can't take this paint)
    // picks up a round brush, so the click always does something you can see.
    if (unavailability(selection.tool, supply.medium) && !unavailability('round', supply.medium)) {
      select('round');
      announcement = `Picked up a round brush for the ${MEDIUM_NAMES[supply.medium].toLowerCase()} paints.`;
    }
    const reason = unavailability(selection.tool, supply.medium);
    if (reason) { announcement = reason; return; }
    paletteMedium = supply.medium; trayOpen = false; paletteOpen = true;
    await revealPalette();
  }
  function changePalette(medium: PaintingMedium) {
    paletteMedium = medium;
    if (medium === 'pastel' || medium === 'pencil' || medium === 'charcoal') select(medium);
  }
  function chooseColor(paint: { name: string; hex: string }) {
    selection = loadPaint(selection, { medium: paletteMedium, name: paint.name, colors: [paint.hex] });
    announcement = `${toolName}, ${MEDIUM_NAMES[paletteMedium]}, ${paint.name}, loaded.`;
  }
  // Mixing loads the brush as you go, like picking a color from a palette:
  // add a color, change the parts, the mode or the medium, then just paint.
  $effect(() => {
    void recipe; void trayMode; void trayMedium;
    untrack(() => { if (trayOpen && paletteOpen) loadTray(); });
  });
  function loadTray() {
    if (!dabs.length || trayReason) return;
    const load: PaintLoad = { medium: trayMedium, name: `Tray: ${trayMode === 'solid' ? 'even mix' : 'streaked'}, ${recipeText(recipe)}`.slice(0, 80), colors: trayMode === 'solid' ? [solidColor] : dabs.map(dab => dab.hex) };
    selection = loadPaint(selection, load);
    announcement = `${toolName} loaded from the color tray: ${recipeText(recipe)}.`;
  }

  // Saved mixes are a per-browser convenience, like saved views.
  function readMixes() {
    try { savedMixes = decodeMixes(localStorage.getItem(SAVED_MIXES_KEY)); } catch { savedMixes = []; }
  }
  function saveMix() {
    if (!recipe.length) return;
    savedMixes = rememberMix(savedMixes, { id: crypto.randomUUID(), recipe: $state.snapshot(recipe), mode: trayMode });
    try { localStorage.setItem(SAVED_MIXES_KEY, JSON.stringify(savedMixes)); announcement = 'Mix saved on this browser.'; }
    catch { announcement = 'This browser could not save the mix. It is still in the tray.'; }
  }
  function useMix(mix: SavedMix) {
    recipe = mix.recipe.map(item => ({ ...item }));
    trayMode = mix.mode;
    announcement = `Tray refilled: ${recipeText(recipe)}.`;
  }
  function rinse() {
    if (!takesWater(selection.tool)) return;
    selection = dipInWater(selection);
    announcement = selection.tool === 'sponge' ? 'Sponge wet. It pushes paint around in runny, textured patches.' : `${toolName} rinsed. Water only.`;
  }
  function wringOut() { selection = { ...selection, wet: false }; announcement = 'Sponge wrung out. It works dry again.'; }
  async function showSettings() { settingsOpen = true; await tick(); document.getElementById('brush-size')?.focus(); }
  function supplyBox(supply: typeof supplies[number]): SupplyRect {
    return geometry.boxes[supply.id] ?? { x: 0, y: headerHeight, width: 100, height: 144 };
  }
  let shown = $derived(viewSupplies ? order.filter(id => viewSupplies!.includes(id)) : shownSupplies(order, activeBox));

</script>

{#if viewsOpen}
  <WorkspaceDrawer>
    <WorkspaceManager views={savedViews} toolboxes={customToolboxes} current={currentLayout()} selected={selectedView}
      signedIn={!!accountState.userId} onupdate={updateViews}
      onapply={(view) => { applyLayout(view.layout); selectedView = view.id; viewsOpen = false; }}
      onclose={() => viewsOpen = false} />
  </WorkspaceDrawer>
{/if}

<svelte:head><title>Painting table — Pass the Canvas</title></svelte:head>
<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} onkeydown={globalKey} onclick={emptySpace} />
<svg class="filter-defs" aria-hidden="true" width="0" height="0"><defs>
  <filter id="supply-selection" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="10" result="expanded" /><feFlood flood-color="#f5f325" /><feComposite in2="expanded" operator="in" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
  </filter>
</defs></svg>

{#snippet tableSave()}
  <!-- The table's own save state (toolbox, positions, views), with a manual save. -->
  <div class={`layout-save ${layoutState}`}>
    <span class="dot" aria-hidden="true"></span><span role="status">{layoutStatus}</span>
    {#if accountState.userId}<button type="button" disabled={layoutSaving || !cloudLoaded || layoutState === 'saved'} onclick={() => void saveCloud()}>Save table</button>{/if}
  </div>
{/snippet}

<!-- The main element only deselects on its own empty tabletop, never a child's click. -->
<main bind:this={bench} onpointermove={tablePointerMove} onpointerleave={() => (hoverId = null)} class:pointing={!!hoverId} class="workbench" class:compact class:grid-view={gridView} class:docked={toolDock !== 'surround'} class:dock-left={toolDock === 'left'} class:dock-right={toolDock === 'right'} class:dock-both={toolDock === 'both'} style:--wood={`url('${asset('wood', 'webp')}')`} style:--header-height={`${headerHeight}px`}>
  <a class="skip" href="#shared-canvas">Skip to canvas</a>
  <header bind:this={statusStrip} class="status-strip">
    <div class="view-control">
      <button type="button" popovertarget="view-options">View · {savedViews.find(view => view.id === selectedView)?.name ?? 'Current arrangement'}{selectedView && !activeViewValue ? ' · modified' : ''}</button>
      <div id="view-options" popover aria-label="Saved views">
        {#each savedViews as view (view.id)}<button type="button" aria-current={activeViewValue === view.id ? 'true' : undefined} onclick={() => { loadView(view.id); document.getElementById('view-options')?.hidePopover(); }}>{view.name}</button>{/each}
        <button type="button" onclick={openViews}>Manage saved views…</button>
        <button type="button" onclick={() => { resetView(); document.getElementById('view-options')?.hidePopover(); }}>Reset studio layout</button>
      </div>
    </div>
    {#if selectedView && !activeViewValue}<button type="button" disabled={layoutSaving || accountSyncing} onclick={() => void saveSelectedView()}>Save view changes</button>{/if}
    <div class="selected-tool"><span>Tool selected</span><strong>{toolName}</strong></div>
    <div class="selected-color"><span>Current color</span><div class="load-line"><span class="load-swatch" class:empty={!selection.load} aria-hidden="true">{#each selection.load?.colors ?? [] as color}<i style:background={color}></i>{/each}</span><strong>{selection.load ? MEDIUM_NAMES[selection.load.medium] : selection.wet ? 'Water only' : selection.tool === 'eraser' || selection.tool === 'sponge' || selection.tool === 'burnisher' ? 'Not needed' : 'Unloaded'}</strong></div></div>
    <!-- Messages live up here, never on the table where you paint. -->
    <p class="header-note" class:fresh={!!notice}>{notice || status}</p>
    <div class="party-bar">{@render partyBar?.()}</div>
    {#if saveStatus}
      <!-- Tap to save now. The dot: amber = unsaved, pulsing = saving, green = saved, red = not saved. -->
      <span class={`save-status ${saveState}`}><span class="dot" aria-hidden="true"></span><span role="status">{saveStatus}</span></span>
    {/if}
    {#if onsave}<button type="button" class="save-now" class:alone={!saveStatus} disabled={saveState === 'saving' || saveState === 'autosaving'} onclick={() => onsave?.()} title="Save (Cmd/Ctrl+S)">Save</button>{/if}
    <button type="button" class="menu-button" popovertarget="table-actions" aria-label="Painting table menu">Menu</button>
  </header>

  <section class="canvas-frame" id="shared-canvas" aria-label="Shared canvas"
    style:--toolbar-space={`${toolbarHeight + 28}px`} style:--surface={`url('${asset('surface', 'webp')}')`} style:--frame-x={`${frameRect.x}px`} style:--frame-y={`${frameRect.y}px`} style:--frame-width={`${frameRect.width}px`} style:--frame-height={`${frameRect.height}px`} style:--canvas-ratio={`${documentSize.width} / ${documentSize.height}`} style:--canvas-aspect={documentSize.width / documentSize.height}>
    <PartyCanvas bind:this={canvas} {selection} {size} intensity={intensity / 100} {canDraw} {painterId} {round} {canvasKey} {label} {wheelZoom} documentWidth={documentSize.width} documentHeight={documentSize.height} baseWidth={canvasBox.width} bind:rotation fitVersion={viewReset} ontoolbarheight={(height) => { if (height > 0) toolbarHeight = height; }} {onstroke} />
  </section>

  <div class="panels">
    {#if selection.tool && settingsOpen}
      <StudioPanel title={toolName} label="brush settings" flow={compact} onclose={() => settingsOpen = false}>
        {#if selection.tool === 'burnisher'}<p class="palette-caption">Smudge &amp; intensify existing color with a dry polishing pad. Works only on your marks; no paint loading needed.</p>{/if}
        <div class="tool-grid">
          <div class="size-controls">
          <div class="size-field"><label for="brush-size">Size <output>{size}</output></label><input id="brush-size" type="range" min="2" max="80" bind:value={size} /></div>
          <label class="exact-field">Exact size<input aria-label="Exact size" type="number" min="2" max="80" value={size} oninput={(event) => { const value = event.currentTarget.valueAsNumber; if (value >= 2 && value <= 80) size = value; }} onchange={(event) => size = Math.round(Math.max(2, Math.min(80, Number(event.currentTarget.value) || 24)))} /></label>
          </div>
          {#if hasIntensity}<div class="intensity-field"><label for="tool-intensity">Intensity <output>{intensity}%</output></label><input id="tool-intensity" type="range" min="0" max="100" step="1" value={intensity} aria-valuetext={`${intensity}%`} oninput={(event) => { if (selection.tool === 'airbrush' || selection.tool === 'burnisher') intensities[selection.tool] = event.currentTarget.valueAsNumber; }} /></div>{/if}
          <div class="load-field"><span>{selection.load ? 'Loaded color' : 'Tool shape'}</span><div class="loaded-row"><div class="brush-preview" aria-hidden="true">{#each selection.load?.colors ?? ['#eee9dc'] as color}<span style:background={color}></span>{/each}</div>{#if isBrush(selection.tool)}<button type="button" class="secondary" onclick={rinse}>Rinse brush</button>{:else if selection.tool === 'sponge'}<button type="button" class="secondary" onclick={selection.wet ? wringOut : rinse}>{selection.wet ? 'Wring out sponge' : 'Wet the sponge'}</button>{/if}</div></div>
        </div>
      </StudioPanel>
    {/if}
    {#if paletteOpen}
      <StudioPanel title={trayOpen ? 'Color tray' : MEDIUM_NAMES[paletteMedium]} label="color palette" dock="palette" flow={compact} onclose={() => paletteOpen = false}>
        {#if trayOpen}
          <!-- The well is the picture; the recipe list below is the control. -->
          <div class="mixing-well" style:background-image={`url('${asset('tray')}')`} aria-hidden="true">
            {#each recipe as item, index (item.hex)}<span class="dab" style:background={trayMode === 'solid' ? solidColor : item.hex} style:left={`${25 + index % 3 * 16}%`} style:top={`${20 + Math.floor(index / 3) * 21}%`} style:scale={0.8 + item.parts * 0.1}></span>{/each}
          </div>
          <ul class="recipe" aria-label={`Tray recipe, ${totalParts(recipe)} of ${MAX_PARTS} parts`}>
            {#each recipe as item (item.hex)}
              <li>
                <span class="swatch" style:background={item.hex} aria-hidden="true"></span>
                <span class="recipe-name">{item.name}</span>
                <button type="button" aria-label={`One less part of ${item.name}`} onclick={() => recipe = removePart(recipe, item.hex)}>−</button>
                <output aria-label={`${item.name} parts`}>{item.parts}</output>
                <button type="button" aria-label={`One more part of ${item.name}`} disabled={totalParts(recipe) >= MAX_PARTS} onclick={() => recipe = addPart(recipe, item)}>+</button>
                <button type="button" class="remove" aria-label={`Remove ${item.name} from the tray`} onclick={() => recipe = removeColor(recipe, item.hex)}>Remove</button>
              </li>
            {:else}
              <li class="empty">Tap colors below to add them. Tap again for another part.</li>
            {/each}
          </ul>
          <fieldset class="tray-options"><legend>In this tray</legend><label><input type="radio" bind:group={trayMode} value="multicolor" /> Keep colors separate (streaks)</label><label><input type="radio" bind:group={trayMode} value="solid" /> Mix evenly</label></fieldset>
          <label class="medium-choice">Medium<select bind:value={trayMedium}><option value="acrylic">Acrylic</option><option value="watercolor">Watercolor</option></select></label>
        {:else}<label class="medium-choice">Paint set<select value={paletteMedium} onchange={(event) => changePalette(event.currentTarget.value as PaintingMedium)}>{#each Object.entries(MEDIUM_NAMES) as [medium, name]}<option value={medium}>{name}</option>{/each}</select></label>{/if}
        <label class="medium-choice">Color palette
          <select value={selectedPalette?.id ?? ''} onchange={(event) => paletteId = event.currentTarget.value}>
            <option value="">Studio {MEDIUM_NAMES[trayOpen ? trayMedium : paletteMedium]} colors</option>
            {#if selectedPalette?.hidden}<option value={selectedPalette.id}>{selectedPalette.name} (tray shortcut)</option>{/if}
            {#each visiblePalettes as palette (palette.id)}<option value={palette.id}>{palette.name}{palette.favorite ? ' (favorite)' : ''}</option>{/each}
          </select>
        </label>
        <div class="paint-grid" role="group" aria-label={trayOpen ? 'Add colors to mixing area' : `${MEDIUM_NAMES[paletteMedium]} colors`}>
          {#each availableColors as paint}<button type="button" title={paint.name} aria-label={paint.name} aria-pressed={!trayOpen && selection.load?.colors.length === 1 && selection.load.colors[0] === paint.hex && selection.load?.medium === paletteMedium} disabled={trayOpen ? totalParts(recipe) >= MAX_PARTS : !!unavailability(selection.tool, paletteMedium)} onclick={() => { if (trayOpen) recipe = addPart(recipe, paint); else chooseColor(paint); }}><span style:background={paint.hex}></span></button>{/each}
        </div>
        {#if trayOpen}<div class="tray-actions"><button type="button" class="secondary" disabled={!recipe.length} onclick={saveMix}>Save mix</button><button type="button" class="secondary" disabled={!recipe.length} onclick={() => recipe = []}>Empty tray</button></div><p class="palette-caption">{trayReason || 'Your brush picks up the tray as you mix. Parts set how much of each color goes in; streaks get wider with more parts.'} Mixing is approximate.</p>
        {#if savedMixes.length}<div class="saved-mixes" role="group" aria-label="Saved mixes"><span>Saved mixes</span>{#each savedMixes as mix (mix.id)}<button type="button" aria-label={`Refill the tray: ${mix.mode === 'solid' ? 'even mix' : 'streaks'}, ${recipeText(mix.recipe)}`} onclick={() => useMix(mix)}><span class="mini" aria-hidden="true">{#each mix.mode === 'solid' ? [mixColor(mix.recipe)] : expand(mix.recipe).map(dab => dab.hex) as color}<i style:background={color}></i>{/each}</span></button>{/each}</div>{/if}
        {:else}<label class="custom-color">Custom color<input type="color" aria-label="Custom paint color" disabled={!!unavailability(selection.tool, paletteMedium)} value={selection.load?.colors[0] ?? '#ffffff'} oninput={(event) => chooseColor({ name: `Custom ${event.currentTarget.value}`, hex: event.currentTarget.value })} /></label><p class="palette-caption" aria-live="polite">{unavailability(selection.tool, paletteMedium) || (selection.load?.medium === paletteMedium ? selection.load.name : 'Choose a color to load your tool.')}</p>{/if}
      </StudioPanel>
    {/if}
  </div>

  <section class="supplies" aria-label="Art supplies">
    {#each shown as id, index (id)}
      {@const supply = supplies.find(supply => supply.id === id)!}
      {@const box = supplyBox(supply)}
      {@const reason = supply.id === 'water' ? takesWater(selection.tool) ? '' : 'Choose a brush or the sponge to dip in water.' : supply.medium && !supply.tool ? unavailability(selection.tool, supply.medium) : ''}
      <div class="supply" data-tool={supply.tool} data-supply={supply.id} class:chosen={active(supply.id)}
        style:--dock-column={index < Math.ceil(shown.length / 2) ? index % 2 + 1 : (index - Math.ceil(shown.length / 2)) % 2 + 4} style:--dock-row={index < Math.ceil(shown.length / 2) ? Math.floor(index / 2) + 1 : Math.floor((index - Math.ceil(shown.length / 2)) / 2) + 1} style:left={`${box.x}px`} style:top={`${box.y}px`} style:width={`${box.width}px`} style:height={`${box.height}px`}>
        <PhotoSupply {masked} hovered={hoverId === supply.id} compact={!masked} tile={gridView} image={supplyImage(supply.id, !masked)} label={supply.name} selected={active(supply.id)} unavailableReason={reason}
          hit={supply.tip ? [supply.tip[0] / supply.box[2] * 100, supply.tip[1] / supply.box[3] * 100, supply.tip[2] / supply.box[2] * 100, supply.tip[3] / supply.box[3] * 100] : supply.hit ? [(supply.hit[0] - supply.box[0]) / supply.box[2] * 100, (supply.hit[1] - supply.box[1]) / supply.box[3] * 100, supply.hit[2] / supply.box[2] * 100, supply.hit[3] / supply.box[3] * 100] : undefined}
          muted={selection.tool !== null && (!!reason || (!!supply.tool && !active(supply.id)))} onclick={() => openSupply(supply)}
          />
      </div>
    {/each}
  </section>
  <div class="sr-only" role="status">{announcement}</div>
</main>

<div id="table-actions" class="table-menu" popover aria-label="Painting table menu">
  {#if menu}<div class="menu-group">{@render menu()}</div>{/if}
  <div class="menu-group">
    <h2>Table</h2>
    <button type="button" onclick={openViews}>Saved views…</button>
    {@render tableSave()}
  </div>
  <div class="menu-group">
    <h2>Painting</h2>
    <button type="button" disabled={!selection.tool} onclick={() => { document.getElementById('table-actions')?.hidePopover(); void showSettings(); }}>Tool settings</button>
    <button type="button" disabled={!selection.tool} onclick={() => { putDown(); document.getElementById('table-actions')?.hidePopover(); }}>Put tool down</button>
    <label class="wheel-option"><input type="checkbox" bind:checked={wheelZoom} /> Scroll wheel zooms canvas</label>
    <button type="button" onclick={() => { canvas?.downloadStrokes(); document.getElementById('table-actions')?.hidePopover(); }}>Export painting data</button>
  </div>
  <!-- Account and site links sit last, after a separator, away from the painting actions. -->
  <div class="menu-group account-group">
    <h2>Account</h2>
    <AccountControls />
    {#if utility}{@render utility()}{/if}
  </div>
</div>

<style lang="scss">
  @use '../../styles/tokens' as *;
  .filter-defs { position: absolute; pointer-events: none; }
  /* manipulation: no double-tap-to-zoom, so quick taps between tools are never swallowed on a tablet. */
  /* The table is an app surface: no text selection or iOS callouts while you reach for tools (form fields still select). */
  .workbench { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; position: relative; width: 100%; height: 100svh; overflow: clip; isolation: isolate; background-image: linear-gradient(#1e0f0599, #1e0f0599), var(--wood); background-size: auto, 1000px; }
  .status-strip { position: absolute; inset: 0 0 auto; min-height: calc(72px * var(--ui-scale, 1)); display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 10px 20px; background: #0c0806ed; z-index: 40; }
  .selected-tool > span, .selected-color > span { display: block; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; color: #e8ddcc; }
  .selected-tool strong { font-family: $font-display; font-size: clamp(18px, 1.6vw, 26px); text-transform: uppercase; }
  .load-line { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .load-swatch { display: flex; width: 90px; height: 24px; border: 1px solid #ece3d3; }
  .load-swatch i { flex: 1; }
  .load-swatch.empty { background: linear-gradient(168deg, transparent 48%, #c05b4b 49% 51%, transparent 52%); }
  button, select, input[type='number'] { min-height: 44px; }
  button, select { font: inherit; color: #fff5e5; background: #1c150fe8; border: 1px solid #9d8c67; border-radius: 4px; padding: 8px 12px; }
  .primary { border-color: #e6df54; font-weight: 700; }
  button:disabled { opacity: 0.5; }
  .canvas-frame { position: absolute; left: var(--frame-x); top: var(--frame-y); width: var(--frame-width); height: var(--frame-height); background: transparent; z-index: 5; }
  .supply { position: absolute; pointer-events: none; z-index: 2; }
  .workbench.pointing { cursor: pointer; }
  .supply.chosen { z-index: 4; }
  /* The burnishing pad is small and rests on the sponge and paint box: keep it on top so it's easy to pick up. */
  .supply[data-supply='burnisher'] { z-index: 3; }
  .tool-grid { display: grid; gap: 4px 16px; align-items: center; }
  .size-controls { display: grid; grid-template-columns: minmax(120px, 1fr) 90px; gap: 16px; align-items: center; }
  .size-field label, .exact-field { display: block; font-size: 12px; font-weight: 700; }
  .intensity-field { grid-column: 1 / -1; order: 3; }
  .intensity-field label { display: block; font-size: 12px; font-weight: 700; }
  #tool-intensity { width: 100%; height: 44px; margin: 0; accent-color: #eee935; }
  output { float: right; }
  #brush-size { width: 100%; height: 44px; margin: 0; accent-color: #eee935; }
  .exact-field input { width: 100%; color: #fff6e9; background: #21180f; border: 1px solid #a48d66; padding: 8px; margin-top: 4px; }
  .load-field { grid-column: 1 / -1; font-size: 12px; }
  .loaded-row { display: flex; gap: 12px; align-items: center; }
  .brush-preview { flex: 1; display: flex; height: 14px; border-radius: 2px; overflow: hidden; }
  .brush-preview span { flex: 1; }
  .loaded-row button { font-size: 12px; }
  @container (min-width: 520px) { .tool-grid { grid-template-columns: minmax(250px, 1fr) minmax(200px, 1fr); } .load-field { grid-column: auto; } }
  .custom-color { display: flex; align-items: center; gap: 12px; font-size: 12px; }
  .custom-color input { width: 64px; height: 44px; padding: 2px; border: 1px solid #aa976a; background: #21180f; }
  .palette-caption { font-size: 12px; line-height: 1.5; margin: 4px 0 10px; }
  .paint-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin: 10px 0; }
  .paint-grid button { padding: 4px; min-width: 44px; min-height: 44px; border: 1px solid #a38e62; }
  .paint-grid button[aria-pressed='true'] { outline: 2px solid #f1ec35; outline-offset: 1px; }
  .paint-grid button > span { display: block; width: 100%; height: 32px; border: 1px solid #fff5; border-radius: 2px; }
  .mixing-well { position: relative; width: 220px; height: 160px; margin: auto; background-position: center; background-size: contain; background-repeat: no-repeat; }
  .recipe { list-style: none; margin: 8px 0; padding: 0; display: grid; gap: 4px; font-size: 13px; }
  .recipe li { display: flex; align-items: center; gap: 6px; }
  .recipe .empty { font-size: 12px; }
  .recipe .swatch { width: 20px; height: 20px; border-radius: 50%; border: 1px solid #fff5; flex: none; }
  .recipe-name { flex: 1; min-width: 0; }
  .recipe button { min-width: 44px; padding: 4px 8px; }
  .recipe .remove { font-size: 12px; }
  .recipe output { float: none; min-width: 1.5em; text-align: center; font-weight: 700; }
  .saved-mixes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; }
  .saved-mixes > span { flex-basis: 100%; font-weight: 700; }
  .saved-mixes button { padding: 6px; }
  .mini { display: flex; width: 64px; height: 18px; border: 1px solid #fff6; }
  .mini i { flex: 1; }
  .dab { position: absolute; width: 44px; height: 44px; min-width: 44px; padding: 0; border-radius: 50%; border: 1px solid #3a2a1a; box-shadow: 1px 3px 4px #0005; }
  .tray-options { display: flex; gap: 12px; flex-wrap: wrap; border: 0; padding: 0; font-size: 12px; }
  .tray-options label, .medium-choice { display: flex; gap: 8px; align-items: center; min-height: 44px; }
  .tray-options input { width: 18px; height: 18px; accent-color: #e6df54; }
  .medium-choice { font-size: 12px; margin-top: 6px; }
  .tray-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .docked:not(.compact) .supplies { position: absolute; top: calc(var(--header-height) + 12px); bottom: 48px; width: min(320px, 27vw); overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; }
  .dock-left:not(.compact) .supplies { left: 12px; }
  .dock-right:not(.compact) .supplies { right: 12px; }
  .dock-both:not(.compact) .supplies { left: 12px; right: 12px; width: auto; grid-template-columns: repeat(2, min(140px, 12vw)) 1fr repeat(2, min(140px, 12vw)); pointer-events: none; }
  .dock-both:not(.compact) .supply { grid-column: var(--dock-column); grid-row: var(--dock-row); }
  .grid-view.docked:not(.compact) .supplies { z-index: 6; }
  .grid-view.docked:not(.compact) .supply, .grid-view.compact .supply { height: 144px !important; min-height: 144px; }
  .grid-view.dock-both:not(.compact) .supplies { z-index: auto; }
  .docked:not(.compact) .supply { position: relative; inset: auto !important; width: 100% !important; height: 128px !important; }
  .party-bar { flex: 0 1 auto; min-width: 0; display: flex; justify-content: flex-end; }
  .party-bar:empty { display: none; }
  .header-note { flex: 1 1 12rem; min-width: 0; margin: 0; font-size: 13px; line-height: 1.4; color: #e8ddcc; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .header-note.fresh { color: #fff6e5; font-weight: 700; }
  .save-status { flex: none; display: inline-flex; align-items: center; gap: 6px; margin: 0 0 0 auto; min-height: 32px; padding: 4px 10px; font-size: 12px; color: #e8ddcc; white-space: nowrap; border-color: #5d4d35; border-radius: 999px; background: #1c150fcc; }
  .save-now.alone { margin-left: auto; }
  .save-now { flex: none; min-height: 36px; padding: 4px 14px; font-size: 13px; font-weight: 700; }
  .save-status + .save-now + .menu-button, .save-status + .menu-button { margin-left: 0; }
  .layout-save { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 4px; padding-top: 8px; border-top: 1px solid #5d4d35; font-size: 12px; color: #e8ddcc; }
  .layout-save [role=status] { flex: 1 1 10rem; }
  .layout-save button { min-height: 36px; padding: 4px 10px; font-size: 12px; }
  .layout-save .dot, .save-status .dot { width: 8px; height: 8px; border-radius: 50%; background: #7fc27f; flex: none; }
  .layout-save.local .dot, .layout-save.loading .dot { background: #b7aa92; }
  .layout-save.unsaved .dot { background: #e6b23c; }
  .layout-save.error .dot { background: #e0604f; }
  .layout-save.saving .dot { animation: save-pulse 1s ease-in-out infinite alternate; }
  .save-status .dot { width: 8px; height: 8px; border-radius: 50%; background: #7fc27f; }
  .save-status.unsaved .dot { background: #e6b23c; }
  .save-status.error .dot { background: #e0604f; }
  .save-status.saving .dot, .save-status.autosaving .dot { background: #e8ddcc; animation: save-pulse 1s ease-in-out infinite alternate; }
  @keyframes save-pulse { from { opacity: .3; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .save-status .dot { animation: none !important; } }
  .save-status + .menu-button { margin-left: 0; }
  /* Interface size (Settings) scales the controls, not the table. */
  .status-strip > *, .table-menu > * { zoom: var(--ui-scale, 1); }
  .menu-button { flex: none; margin-left: auto; min-height: 40px; padding: 6px 16px; font-size: 14px; }
  .account-group :global(.account-controls) { font-size: 13px; }
  .view-control { position: relative; font-size: 13px; }
  .view-control > button { padding: 10px; min-height: 44px; border: 1px solid #9d8c67; border-radius: 4px; cursor: pointer; }
  .view-control > div { position: fixed; inset: calc(var(--header-height) + 4px) auto auto 12px; margin: 0; width: min(320px, calc(100vw - 24px)); max-height: min(60svh, calc(100svh - var(--header-height) - 16px)); overflow: auto; padding: 6px; color: #fff5e4; background: #21180f; border: 1px solid #9d8c67; }
  .view-control > div:popover-open { display: grid; gap: 4px; }
  .view-control button { text-align: left; }
  .wheel-option input { width: 18px; height: 18px; accent-color: #eee935; }
  .workbench :global(input), .workbench :global(textarea) { -webkit-user-select: text; user-select: text; }
  .table-menu { position: fixed; inset: 96px 16px auto auto; width: min(calc(280px * var(--ui-scale, 1)), calc(100vw - 32px)); max-height: calc(100svh - 112px); overflow: auto; margin: 0; background: #21180f; color: #fff5e4; border: 1px solid #aa976a; border-radius: 6px; padding: 14px 16px 16px; box-shadow: 0 10px 28px #000a; }
  .table-menu h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #e8ddcc; margin: 0 0 6px; }
  .menu-group + .menu-group { margin-top: 14px; padding-top: 14px; border-top: 1px solid #5d4d35; }
  .table-menu :global(.menu-group > button), .table-menu :global(.menu-group > a) { display: flex; align-items: center; width: 100%; min-height: 44px; margin: 4px 0; padding: 8px 12px; text-align: left; font: inherit; color: #fff5e5; background: #1c150fe8; border: 1px solid #9d8c67; border-radius: 4px; text-decoration: none; box-sizing: border-box; cursor: pointer; }
  .table-menu :global(.menu-group > button:disabled) { opacity: .5; cursor: default; }
  .table-menu :global(.menu-group > a:hover), .table-menu :global(.menu-group > button:not(:disabled):hover) { background: #2e2316; }
  .table-menu :global(:focus-visible) { outline: 3px solid #f5ed37; outline-offset: 2px; }
  .skip { position: absolute; left: 16px; top: -100px; z-index: 50; padding: 12px; background: #fff5e4; color: #21160d; }
  .skip:focus { top: 100px; }
  .wheel-option { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
  .compact { height: auto; min-height: 100svh; overflow: visible; padding: 0 12px calc(144px + env(safe-area-inset-bottom, 0px)); }
  .compact .status-strip { position: relative; margin: 0 -12px; min-height: 88px; gap: 12px; flex-wrap: wrap; padding: 12px; }
  .compact .selected-tool { flex: 1; min-width: 120px; }
  .compact .selected-color { flex: 1; }
  .compact .canvas-frame { position: relative; inset: auto; width: min(100%, var(--frame-width)); height: var(--frame-height); margin: var(--toolbar-space) auto 32px; }
  .compact .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); align-items: start; gap: 12px; margin-bottom: 16px; }
  .compact .panels:empty { display: none; }
  .compact .supplies { display: grid; grid-template-columns: repeat(auto-fit, minmax(clamp(100px, 13vw, 168px), 1fr)); gap: 12px 8px; }
  .compact .supply { position: relative; inset: auto !important; width: 100% !important; height: clamp(122px, 12vw, 170px) !important; }
  @media (max-width: 600px) { .paint-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } .status-strip { font-size: 12px; } .selected-tool strong { font-size: 18px; } .load-swatch { width: 60px; } }
</style>
