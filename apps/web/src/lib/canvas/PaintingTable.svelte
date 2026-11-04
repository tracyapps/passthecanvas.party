<!--
  The party's painting table: photographic supplies around the shared canvas,
  movable tool/palette panels, Paint / Arrange & view, saved layouts.
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
  import PhotoSupply from './PhotoSupply.svelte';
  import StudioPanel from './StudioPanel.svelte';
  import PartyCanvas from './PartyCanvas.svelte';
  import { addPart, decodeMixes, expand, mixColor, recipeText, rememberMix, removeColor, removePart, totalParts, MAX_PARTS, SAVED_MIXES_KEY, type Recipe, type SavedMix } from './recipes';
  import { PALETTES } from './palettes';
  import { defaultLayout, decodeWorkspaces, gridDestination, WORKSPACE_KEY, type WorkspaceLayout, type SavedWorkspace, type ToolDock } from './workspaces';
  import burnishingPad from './burnishing-pad.svg?url';
  import { constrainSupply, type SupplyRect } from './placement';
  import { emptySelection, selectTool, loadPaint, dipInWater, isBrush, unavailability,
    TOOL_NAMES, MEDIUM_NAMES, type PaintingTool, type PaintingMedium, type PaintLoad } from './painting-selection';
  const images = import.meta.glob('./supplies/study-*.{svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
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
  }
  let { canDraw, painterId, round, canvasKey, canvasSize, label, waitingNote, onstroke, partyBar, menu, utility, notice = '' }: Props = $props();
  let canvas = $state<PartyCanvas>();
  export function applyRemote(stroke: PaintedStroke) { canvas?.applyRemote(stroke); }
  export async function loadHistory(key: string, width: number, height: number, strokes: PaintedStroke[], complete: boolean, baseUrl: string | null) { await canvas?.loadHistory(key, width, height, strokes, complete, baseUrl); }
  export function snapshot(): string { return canvas?.snapshot() ?? ''; }
  export function finishStroke() { canvas?.finishStroke(); }
  export function strokes(): PaintedStroke[] { return canvas?.strokes() ?? []; }

  function asset(name: string, extension = 'svg'): string { return images[`./supplies/study-${name}.${extension}`] ?? ''; }
  const supplies: { id: string; name: string; box: number[]; hit?: number[]; tip?: number[]; tool?: PaintingTool; medium?: PaintingMedium }[] = [
    { id: 'acrylic', name: 'Acrylic paints', box: [0, 0, 320, 230], hit: [160, 12, 150, 140], medium: 'acrylic' },
    { id: 'tray', name: 'Color mixing tray', box: [0, 190, 200, 180] },
    { id: 'pastel', name: 'Pastels', box: [0, 460, 230, 200], tool: 'pastel', medium: 'pastel' },
    { id: 'charcoal', name: 'Charcoal', box: [0, 630, 240, 205], tool: 'charcoal', medium: 'charcoal' },
    { id: 'water', name: 'Water', box: [0, 800, 170, 220], hit: [0, 810, 125, 190] },
    { id: 'eraser', name: 'Eraser', box: [120, 895, 125, 125], hit: [125, 945, 85, 75], tool: 'eraser' },
    { id: 'sponge', name: 'Texture sponge', box: [175, 860, 170, 175], hit: [215, 880, 120, 140], tool: 'sponge' },
    { id: 'burnisher', name: 'Burnishing pad', box: [230, 730, 160, 115], tool: 'burnisher' },
    { id: 'watercolor', name: 'Watercolor paints', box: [350, 845, 430, 170], medium: 'watercolor' },
    { id: 'pencil', name: 'Pencils', box: [785, 810, 205, 280], tip: [0, 0, 205, 130], tool: 'pencil', medium: 'pencil' },
    { id: 'knife', name: 'Palette knives', box: [965, 805, 230, 290], tip: [20, 0, 190, 155], tool: 'knife' },
    { id: 'foam', name: 'Foam brushes', box: [1140, 855, 200, 240], tip: [0, 0, 180, 140], tool: 'foam' },
    { id: 'flat', name: 'Flat brushes', box: [1220, 740, 340, 340], tip: [0, 0, 260, 200], tool: 'flat' },
    { id: 'fan', name: 'Fan brush', box: [1280, 610, 250, 235], tip: [10, 10, 120, 110], tool: 'fan' },
    { id: 'round', name: 'Round brush', box: [1300, 485, 220, 205], tip: [0, 0, 105, 100], tool: 'round' },
    { id: 'detail', name: 'Detail brush', box: [1300, 370, 240, 230], tip: [0, 0, 90, 90], tool: 'detail' },
    { id: 'airbrush', name: 'Airbrush', box: [1280, 225, 255, 170], tip: [0, 35, 160, 130], tool: 'airbrush' }
  ];
  let bench: HTMLElement;
  let supplyGrid: HTMLElement;
  let canvasFrame: HTMLElement;
  let statusStrip: HTMLElement;
  let headerHeight = $state(88);
  let dock = $state<ToolDock>('surround');
  let rotation = $state(0);
  let viewReset = $state(0);
  let toolbarHeight = $state(110);
  /** A canvas window you've resized by its edges, in pixels. Null = the default for this screen. */
  let frameOverride = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let documentSize = $derived(canvasSize);
  let savedViews = $state<SavedWorkspace[]>([]);
  let selectedView = $state('');
  let viewName = $state('');
  let activeViewValue = $derived.by(() => {
    const saved = savedViews.find(view => view.id === selectedView);
    return saved && JSON.stringify(saved.layout) === JSON.stringify(currentLayout()) ? selectedView : '';
  });
  let storageReady = $state(false);
  let storageError = $state('');
  let accountLoadedFor = $state<string | null | undefined>();
  let accountSyncing = $state(false);
  let cloudEnabled = $state(false);
  let cloudLoaded = $state(false);
  let accountMessage = $state('');
  let cloudQueue = Promise.resolve();
  let board = $state({ width: 1440, height: 1024 });
  let windowWidth = $state(innerWidth);
  let windowHeight = $state(innerHeight);
  let compact = $derived(windowWidth <= 1100 || windowHeight <= 720 || windowWidth / windowHeight < 1.35);
  let selection = $state(emptySelection());
  let mode = $state<'paint' | 'arrange'>('paint');
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
  let target = $state('acrylic');
  let positions = $state<Record<string, { x: number; y: number }>>({});
  let dragging: { id: string; x: number; y: number; left: number; top: number; pointer: number } | null = null;
  let toolName = $derived(selection.tool ? TOOL_NAMES[selection.tool] : 'None');
  let status = $derived(mode === 'arrange' ? 'Canvas locked. Arrange supplies or explore the artwork.'
    : !canDraw ? `${waitingNote} Get your tools ready while you wait.`
    : !selection.tool ? 'Choose a tool to begin. Drag the canvas (or hold Space) to move around.'
    : selection.tool === 'burnisher' ? 'Smudge & intensify. Only your own turn will change.'
    : selection.tool === 'eraser' || selection.tool === 'sponge' ? 'Ready. Only your own turn will change.'
    : selection.load ? `${selection.load.name}${selection.wet ? ', with water' : ''}. Ready to paint.`
    : selection.wet ? 'Water only. Only your own turn will change.' : 'Choose a compatible paint to load your tool.');
  let trayReason = $derived(unavailability(selection.tool, trayMedium));
  let solidColor = $derived(mixColor(recipe));
  let availableColors = $derived(PALETTES[trayOpen ? trayMedium : paletteMedium]);
  // The default canvas window depends only on the screen, the tool dock and the
  // canvas shape. Palettes and settings panels float above it, so opening one
  // never moves the canvas or the supplies.
  let canvasBox = $derived.by(() => {
    const top = headerHeight + toolbarHeight + 16;
    const scale = Math.min(board.width / 1440, board.height / 1024);
    // Leave room for the acrylic rack (the widest supply on the left) beside the canvas.
    const left = dock === 'right' ? 24 : dock === 'left' || dock === 'both' ? Math.min(360, board.width * .3) : Math.max(board.width * 0.18, 352 * scale);
    const rightRail = dock === 'right' || dock === 'both' ? Math.min(360, board.width * .3) : dock === 'left' ? 24 : Math.max(board.width * 0.12, 260 * scale + 40);
    const available = Math.max(300, board.width - left - rightRail);
    const bottomSpace = dock !== 'surround' ? 56 : 250 * scale + 20;
    const width = Math.min(available, Math.max(260, (board.height - top - bottomSpace) * documentSize.width / documentSize.height));
    return { x: left + (available - width) / 2, y: top, width, height: width * documentSize.height / documentSize.width };
  });
  let frameRect = $derived(frameOverride ?? canvasBox);
  /** Keep a resized window on screen and at a usable size. */
  function fitFrame(rect: { x: number; y: number; width: number; height: number }, edge: Edge) {
    const minW = 260, minH = 200, top = headerHeight + toolbarHeight + 8;
    let { x, y, width, height } = rect;
    if (edge === 'left') { const right = x + width; x = Math.max(0, Math.min(right - minW, x)); width = right - x; }
    if (edge === 'top') { const bottom = y + height; y = Math.max(top, Math.min(bottom - minH, y)); height = bottom - y; }
    width = Math.max(minW, Math.min(board.width - x, width));
    height = Math.max(minH, Math.min(board.height - y - 8, height));
    return { x, y, width, height };
  }
  type Edge = 'top' | 'right' | 'bottom' | 'left' | 'corner';
  const EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];
  let edgeDrag: { edge: Edge; x: number; y: number; rect: { x: number; y: number; width: number; height: number }; pointer: number } | null = null;
  function moveEdge(edge: Edge, rect: { x: number; y: number; width: number; height: number }, dx: number, dy: number) {
    const next = { ...rect };
    if (edge === 'left') { next.x += dx; next.width -= dx; }
    if (edge === 'right' || edge === 'corner') next.width += dx;
    if (edge === 'top') { next.y += dy; next.height -= dy; }
    if (edge === 'bottom' || edge === 'corner') next.height += dy;
    frameOverride = fitFrame(next, edge);
  }
  function startEdge(event: PointerEvent, edge: Edge) {
    if (event.button !== 0) return;
    edgeDrag = { edge, x: event.clientX, y: event.clientY, rect: { ...frameRect }, pointer: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function dragEdge(event: PointerEvent) {
    if (edgeDrag && event.pointerId === edgeDrag.pointer) moveEdge(edgeDrag.edge, edgeDrag.rect, event.clientX - edgeDrag.x, event.clientY - edgeDrag.y);
  }
  function edgeKey(event: KeyboardEvent, edge: Edge) {
    const steps: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    moveEdge(edge, frameRect, step[0], step[1]);
  }
  onMount(() => {
    board = { width: bench.clientWidth, height: bench.clientHeight };
    headerHeight = statusStrip.clientHeight;
    const observer = new ResizeObserver(() => { board = { width: bench.clientWidth, height: bench.clientHeight }; });
    observer.observe(bench);
    const headerObserver = new ResizeObserver(() => headerHeight = statusStrip.clientHeight);
    headerObserver.observe(statusStrip);
    readMixes();
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw) { const stored = decodeWorkspaces(raw, supplies.map(item => item.id)); savedViews = stored.views; selectedView = stored.selected; applyLayout(stored.current); }
    } catch { storageError = 'Saved views could not be read. Existing browser data has been kept.'; }
    storageReady = true;
    return () => { observer.disconnect(); headerObserver.disconnect(); };
  });
  function currentLayout(): WorkspaceLayout { return { positions: $state.snapshot(positions), order: [...order], dock, frame: frameOverride ? { x: frameOverride.x / windowWidth, y: frameOverride.y / windowHeight, width: frameOverride.width / windowWidth, height: frameOverride.height / windowHeight } : null, rotation }; }
  function applyLayout(layout: WorkspaceLayout) {
    positions = $state.snapshot(layout.positions); order = [...layout.order]; dock = layout.dock; rotation = layout.rotation;
    // Older saved views only kept a size; they reopen at the default spot.
    frameOverride = layout.frame && typeof layout.frame.x === 'number' && typeof layout.frame.y === 'number' ? { x: layout.frame.x * windowWidth, y: layout.frame.y * windowHeight, width: layout.frame.width * windowWidth, height: layout.frame.height * windowHeight } : null;
    viewReset += 1;
  }
  $effect(() => {
    const state = { version: 1, current: currentLayout(), views: $state.snapshot(savedViews), selected: selectedView };
    if (!storageReady || storageError || !accountState.ready || accountSyncing || accountLoadedFor !== accountState.userId) return;
    try { localStorage.setItem(browserKey(accountState.userId), JSON.stringify(state)); }
    catch { storageError = 'This browser could not save the layout. Your current view is still usable.'; }
  });
  function browserKey(userId: string | null) { return userId ? `${WORKSPACE_KEY}:${userId}` : WORKSPACE_KEY; }
  function workspaceState() { return { version: 1, current: currentLayout(), views: $state.snapshot(savedViews), selected: selectedView }; }
  function restoreWorkspace(value: unknown) {
    const stored = decodeWorkspaces(JSON.stringify(value), supplies.map(item => item.id));
    savedViews = stored.views; selectedView = stored.selected; applyLayout(stored.current);
  }
  async function restoreAccount(userId: string | null) {
    accountSyncing = true; cloudEnabled = false; cloudLoaded = false; storageError = ''; accountMessage = '';
    savedViews = []; selectedView = ''; applyLayout(defaultLayout(supplies.map(item => item.id)));
    try {
      const raw = localStorage.getItem(browserKey(userId));
      if (raw) restoreWorkspace(JSON.parse(raw));
      else { savedViews = []; selectedView = ''; applyLayout(defaultLayout(supplies.map(item => item.id))); }
    } catch { storageError = 'Browser views could not be read. Existing data has been kept.'; }
    if (!userId) { accountSyncing = false; return; }
    try {
      const remote = await loadAccountWorkspaces();
      if (accountState.userId !== userId) return;
      if (remote !== null) { restoreWorkspace(remote); cloudEnabled = true; accountMessage = 'Account views restored. Changes to this arrangement will save automatically.'; }
      else accountMessage = 'No account views yet. Save a view or explicitly import your browser views.';
      cloudLoaded = true;
    } catch (error) { if (accountState.userId === userId) accountMessage = error instanceof Error ? error.message : 'Account views could not be loaded.'; }
    finally { if (accountState.userId === userId) accountSyncing = false; }
  }
  $effect(() => {
    if (!storageReady || !accountState.ready || accountLoadedFor === accountState.userId) return;
    accountLoadedFor = accountState.userId;
    void restoreAccount(accountState.userId);
  });
  async function saveCloud(value = workspaceState()) {
    const userId = accountState.userId;
    if (!userId || accountSyncing) return;
    if (!cloudLoaded) { accountMessage = 'Load account views successfully before saving changes to the account.'; return; }
    const save = cloudQueue.then(async () => {
      if (accountState.userId !== userId) return;
      await saveAccountWorkspaces(value);
      if (accountState.userId === userId) { cloudEnabled = true; accountMessage = 'Saved to your account.'; }
    });
    cloudQueue = save.catch(() => {});
    try { await save; } catch (error) { if (accountState.userId === userId) accountMessage = error instanceof Error ? error.message : 'Account save failed. Browser copy retained.'; }
  }
  $effect(() => {
    const value = workspaceState();
    if (!cloudEnabled || !accountState.userId || accountSyncing || !storageReady) return;
    const timer = setTimeout(() => void saveCloud(value), 1200);
    return () => clearTimeout(timer);
  });
  function importBrowserViews() {
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (!raw) { accountMessage = 'No guest browser views to import.'; return; }
      const guest = decodeWorkspaces(raw, supplies.map(item => item.id));
      const ids = new Set(savedViews.map(view => view.id));
      if (savedViews.length + guest.views.filter(view => !ids.has(view.id)).length > 30) { accountMessage = 'Import would exceed the 30-view limit.'; return; }
      savedViews = [...savedViews, ...guest.views.filter(view => !ids.has(view.id))];
      void saveCloud();
    } catch { accountMessage = 'Browser views could not be imported. The original data has been kept.'; }
  }
  function saveView() {
    if (storageError) { announcement = storageError; return; }
    const name = viewName.trim().slice(0, 80);
    if (!name) { announcement = 'Give this view a name first.'; return; }
    if (savedViews.length >= 30) { announcement = 'Up to 30 views can be saved in this browser.'; return; }
    const id = crypto.randomUUID(); savedViews = [...savedViews, { id, name, layout: currentLayout() }]; selectedView = id; viewName = ''; announcement = `${name} saved on this browser.`; if (accountState.userId) void saveCloud();
  }
  function loadView(id: string) { const view = savedViews.find(item => item.id === id); if (view) { applyLayout(view.layout); selectedView = id; announcement = `${view.name} restored.`; } }
  function putDown() {
    selection = { ...selection, tool: null, load: null, wet: false };
    paletteOpen = false;
    announcement = 'Tool put down. The artwork is unchanged.';
  }
  function globalKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    putDown();
  }
  function emptySpace(event: MouseEvent) { if (event.target === bench && !dragging) putDown(); }
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
    if (id === 'water') return selection.wet;
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
    if (mode === 'arrange') { target = supply.id; return; }
    if (supply.id === 'water') { selection = dipInWater(selection); announcement = `${toolName} dipped in water.`; return; }
    if (supply.id === 'tray') { trayOpen = true; paletteOpen = true; await revealPalette(); return; }
    if (supply.tool) select(supply.tool);
    if (!supply.medium) { if (compact) await showSettings(); return; }
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
  function rinse() { selection = { ...selection, load: null, wet: true }; announcement = `${toolName} rinsed. Water only.`; }
  async function showSettings() { settingsOpen = true; await tick(); document.getElementById('brush-size')?.focus(); }
  function supplyBox(supply: typeof supplies[number]): SupplyRect {
    const scale = Math.min(board.width / 1440, board.height / 1024);
    const width = supply.box[2] * scale;
    const height = supply.box[3] * scale;
    const saved = positions[supply.id];
    let x = saved ? saved.x * board.width : supply.box[0] / 1440 * board.width;
    let y = saved ? saved.y * board.height : supply.box[1] / 1024 * board.height;
    const tip = supply.tip ? { x: supply.tip[0] * scale, y: supply.tip[1] * scale, width: supply.tip[2] * scale, height: supply.tip[3] * scale } : undefined;
    if (!saved && tip) {
      if (['pencil', 'knife', 'foam'].includes(supply.id)) {
        y = board.height - height * 0.78;
      } else {
        x = board.width - width * 0.78;
      }
    }
    if (!saved && supply.id === 'burnisher') {
      const sponge = supplyBox(supplies.find(item => item.id === 'sponge')!);
      x = sponge.x + sponge.width * 0.7;
      y = sponge.y + sponge.height * 0.57;
    }
    // Supplies can sit right up to the screen edges. A supply you've placed stays
    // where you put it; only the default spots step around the default canvas
    // window (so opening a panel or resizing the canvas window never moves them).
    const bounds = { x: 0, y: headerHeight, width: board.width, height: Math.max(200, board.height - headerHeight) };
    if (saved) return constrainSupply({ x, y, width, height }, bounds, tip);
    const frame = { x: canvasBox.x - 12, y: canvasBox.y - toolbarHeight - 16, width: canvasBox.width + 24, height: canvasBox.height + toolbarHeight + 56 };
    return constrainSupply({ x, y, width, height }, bounds, tip, frame);
  }
  function startMove(event: PointerEvent, supply: typeof supplies[number]) {
    if (mode !== 'arrange' || compact || dock !== 'surround' || event.button !== 0) return;
    const box = supplyBox(supply);
    target = supply.id;
    dragging = { id: supply.id, x: event.clientX, y: event.clientY, left: box.x, top: box.y, pointer: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function moveSupply(event: PointerEvent) {
    if (!dragging || event.pointerId !== dragging.pointer) return;
    positions[dragging.id] = { x: (dragging.left + event.clientX - dragging.x) / board.width, y: (dragging.top + event.clientY - dragging.y) / board.height };
  }
  function nudge(dx: number, dy: number) {
    const supply = supplies.find(supply => supply.id === target)!;
    if (compact || dock !== 'surround') {
      // On the flowing layout, reorder rather than pushing controls offscreen.
      const index = order.indexOf(target);
      const columns = dock === 'both' && !compact ? 2 : Math.max(1, getComputedStyle(supplyGrid).gridTemplateColumns.split(' ').length);
      const split = Math.ceil(order.length / 2);
      const offset = dock === 'both' && !compact && index >= split ? split : 0;
      const count = dock === 'both' && !compact ? offset ? order.length - split : split : order.length;
      const next = gridDestination(index - offset, count, columns, dx, dy) + offset;
      const copy = [...order]; copy.splice(index, 1); copy.splice(next, 0, target); order = copy;
    } else {
      const box = supplyBox(supply);
      positions[target] = { x: (box.x + dx) / board.width, y: (box.y + dy) / board.height };
    }
  }
  let order = $state(supplies.map(supply => supply.id));
  function supplyKey(event: KeyboardEvent, id: string) {
    if (mode !== 'arrange') return;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
    if (moves[event.key]) { event.preventDefault(); target = id; nudge(...moves[event.key]); }
  }
</script>

<svelte:head><title>Painting table — Pass the Canvas</title></svelte:head>
<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} onkeydown={globalKey} onclick={emptySpace} />
<svg class="filter-defs" aria-hidden="true" width="0" height="0"><defs>
  <filter id="supply-selection" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="10" result="expanded" /><feFlood flood-color="#f5f325" /><feComposite in2="expanded" operator="in" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
  </filter>
</defs></svg>

<!-- The main element only deselects on its own empty tabletop, never a child's click. -->
<main bind:this={bench} class="workbench" class:compact class:docked={dock !== 'surround'} class:dock-left={dock === 'left'} class:dock-right={dock === 'right'} class:dock-both={dock === 'both'} class:arranging={mode === 'arrange'} style:--wood={`url('${asset('wood', 'webp')}')`} style:--header-height={`${headerHeight}px`}>
  <a class="skip" href="#shared-canvas">Skip to canvas</a>
  <header bind:this={statusStrip} class="status-strip">
    <div class="mode" role="group" aria-label="Workspace mode">
      <button type="button" aria-pressed={mode === 'paint'} onclick={() => mode = 'paint'}>Paint</button>
      <button type="button" aria-pressed={mode === 'arrange'} onclick={() => { mode = 'arrange'; paletteOpen = false; }}>Arrange &amp; view</button>
    </div>
    <div class="selected-tool"><span>Tool selected</span><strong>{toolName}</strong></div>
    <div class="selected-color"><span>Current color</span><div class="load-line"><span class="load-swatch" class:empty={!selection.load} aria-hidden="true">{#each selection.load?.colors ?? [] as color}<i style:background={color}></i>{/each}</span><strong>{selection.load ? MEDIUM_NAMES[selection.load.medium] : selection.wet ? 'Water only' : selection.tool === 'eraser' || selection.tool === 'sponge' || selection.tool === 'burnisher' ? 'Not needed' : 'Unloaded'}</strong></div></div>
    <!-- Messages live up here, never on the table where you paint. -->
    <p class="header-note" class:fresh={!!notice}>{notice || status}</p>
    <div class="party-bar">{@render partyBar?.()}</div>
    <button type="button" class="menu-button" popovertarget="table-actions" aria-label="Painting table menu">Menu</button>
  </header>

  <section bind:this={canvasFrame} class="canvas-frame" id="shared-canvas" aria-label="Shared canvas"
    style:--toolbar-space={`${toolbarHeight + 28}px`} style:--surface={`url('${asset('surface')}')`} style:--frame-x={`${frameRect.x}px`} style:--frame-y={`${frameRect.y}px`} style:--frame-width={`${frameRect.width}px`} style:--frame-height={`${frameRect.height}px`} style:--canvas-ratio={`${documentSize.width} / ${documentSize.height}`} style:--canvas-aspect={documentSize.width / documentSize.height}>
    <PartyCanvas bind:this={canvas} {selection} {size} intensity={intensity / 100} {mode} {canDraw} {painterId} {round} {canvasKey} {label} {wheelZoom} documentWidth={documentSize.width} documentHeight={documentSize.height} baseWidth={compact ? Math.min(board.width - 24, windowHeight * .58 * documentSize.width / documentSize.height) : canvasBox.width} bind:rotation fitVersion={viewReset} ontoolbarheight={(height) => toolbarHeight = height} {onstroke} />
    {#if !compact}
      <!-- Drag any edge (or the corner) to resize the canvas window; arrow keys work too. -->
      {#each EDGES as edge (edge)}
        <button type="button" class={`edge edge-${edge}`} aria-label={`Resize the canvas window from its ${edge} edge. Drag or use arrow keys.`}
          onpointerdown={(event) => startEdge(event, edge)} onpointermove={dragEdge} onpointerup={() => edgeDrag = null} onpointercancel={() => edgeDrag = null} onkeydown={(event) => edgeKey(event, edge)}></button>
      {/each}
      <button type="button" class="corner" aria-label="Resize the canvas window. Drag or use arrow keys."
        onpointerdown={(event) => startEdge(event, 'corner')} onpointermove={dragEdge} onpointerup={() => edgeDrag = null} onpointercancel={() => edgeDrag = null} onkeydown={(event) => edgeKey(event, 'corner')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 20 14-14M12 20l8-8M18 20l2-2" /></svg></button>
    {/if}
  </section>

  <div class="panels">
    {#if mode === 'arrange'}
      <!-- Floats over the (locked) canvas so the header and the supplies never shift while you arrange them. -->
      <StudioPanel title="Arrange table" label="arrange table" dock="arrange" flow={compact} onclose={() => mode = 'paint'}>
        <div class="arrange-controls">
          <label class="arrange-field">Supply<select bind:value={target}>{#each supplies as supply}<option value={supply.id}>{supply.name}</option>{/each}</select></label>
          <div class="nudge-pad" role="group" aria-label={compact || dock !== 'surround' ? 'Reorder the chosen supply' : 'Move the chosen supply'}>
            <button type="button" class="up" aria-label="Up" onclick={() => nudge(0, -32)}>↑</button>
            <button type="button" class="left" aria-label="Left" onclick={() => nudge(-32, 0)}>←</button>
            <button type="button" class="down" aria-label="Down" onclick={() => nudge(0, 32)}>↓</button>
            <button type="button" class="right" aria-label="Right" onclick={() => nudge(32, 0)}>→</button>
          </div>
          <label class="arrange-field">Tools<select aria-label="Tool placement" bind:value={dock}><option value="surround">Around canvas</option><option value="both">Columns both sides</option><option value="left">Columns on left</option><option value="right">Columns on right</option></select></label>
          <p class="arrange-hint">{compact || dock !== 'surround' ? 'Pick a supply, then use the arrows to reorder it.' : 'Drag supplies on the table, or pick one and use the arrows.'} Painting is locked while arranging.</p>
          <div class="arrange-actions">
            <button type="button" onclick={() => { applyLayout(defaultLayout(supplies.map(supply => supply.id))); selectedView = ''; announcement = 'Layout reset.'; }}>Reset layout</button>
            <button type="button" class="primary" onclick={() => mode = 'paint'}>Done</button>
          </div>
          <details class="workspace-menu"><summary>Saved views</summary><div><p>{accountState.userId ? 'Views are linked to your signed-in account.' : 'Saved on this browser. Sign in from Account to save them to your account.'}</p><label>Saved view<select aria-label="Saved view" value={activeViewValue} onchange={(event) => loadView(event.currentTarget.value)}><option value="">Current arrangement</option>{#each savedViews as saved}<option value={saved.id}>{saved.name}</option>{/each}</select></label><label>View name<input aria-label="View name" maxlength="80" bind:value={viewName} /></label><button type="button" onclick={saveView}>Save as new view</button><button type="button" disabled={!selectedView} onclick={() => { savedViews = savedViews.map(view => view.id === selectedView ? { ...view, layout: currentLayout() } : view); announcement = 'Saved view updated.'; }}>Update saved view</button><button type="button" disabled={!selectedView} onclick={() => { savedViews = savedViews.filter(view => view.id !== selectedView); selectedView = ''; }}>Delete saved view</button>{#if accountState.userId}<button type="button" disabled={accountSyncing || !cloudLoaded} onclick={() => void saveCloud()}>Save views to account</button><button type="button" disabled={accountSyncing} onclick={() => void restoreAccount(accountState.userId)}>Reload account views</button><button type="button" disabled={accountSyncing || !cloudLoaded} onclick={importBrowserViews}>Import browser views to account</button>{/if}<p role="status">{storageError || accountMessage || 'Your latest arrangement is restored automatically.'}</p></div></details>
        </div>
      </StudioPanel>
    {/if}
    {#if mode === 'paint' && selection.tool && settingsOpen}
      <StudioPanel title={toolName} label="brush settings" flow={compact} onclose={() => settingsOpen = false}>
        {#if selection.tool === 'burnisher'}<p class="palette-caption">Smudge &amp; intensify existing color with a dry polishing pad. Works only on your marks; no paint loading needed.</p>{/if}
        <div class="tool-grid">
          <div class="size-controls">
          <div class="size-field"><label for="brush-size">Size <output>{size}</output></label><input id="brush-size" type="range" min="2" max="80" bind:value={size} /></div>
          <label class="exact-field">Exact size<input aria-label="Exact size" type="number" min="2" max="80" value={size} oninput={(event) => { const value = event.currentTarget.valueAsNumber; if (value >= 2 && value <= 80) size = value; }} onchange={(event) => size = Math.round(Math.max(2, Math.min(80, Number(event.currentTarget.value) || 24)))} /></label>
          </div>
          {#if hasIntensity}<div class="intensity-field"><label for="tool-intensity">Intensity <output>{intensity}%</output></label><input id="tool-intensity" type="range" min="0" max="100" step="1" value={intensity} aria-valuetext={`${intensity}%`} oninput={(event) => { if (selection.tool === 'airbrush' || selection.tool === 'burnisher') intensities[selection.tool] = event.currentTarget.valueAsNumber; }} /></div>{/if}
          <div class="load-field"><span>{selection.load ? 'Loaded color' : 'Tool shape'}</span><div class="loaded-row"><div class="brush-preview" aria-hidden="true">{#each selection.load?.colors ?? ['#eee9dc'] as color}<span style:background={color}></span>{/each}</div>{#if isBrush(selection.tool)}<button type="button" class="secondary" onclick={rinse}>Rinse brush</button>{/if}</div></div>
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
        {:else}<label class="medium-choice">Paint set<select value={paletteMedium} onchange={(event) => changePalette(event.currentTarget.value as PaintingMedium)}>{#each Object.entries(MEDIUM_NAMES) as [medium, name]}<option value={medium}>{name}</option>{/each}</select></label><p class="palette-caption">{#if paletteMedium === 'pencil' || paletteMedium === 'charcoal'}{availableColors.length} colors · pictured shades plus extra studio colors.{:else}{availableColors.length} colors from the pictured {MEDIUM_NAMES[paletteMedium].toLowerCase()} set.{/if}</p>{/if}
        <div class="paint-grid" role="group" aria-label={trayOpen ? 'Add colors to mixing area' : `${MEDIUM_NAMES[paletteMedium]} colors`}>
          {#each availableColors as paint}<button type="button" title={paint.name} aria-label={paint.name} aria-pressed={!trayOpen && selection.load?.name === paint.name} disabled={trayOpen ? totalParts(recipe) >= MAX_PARTS : !!unavailability(selection.tool, paletteMedium)} onclick={() => { if (trayOpen) recipe = addPart(recipe, paint); else chooseColor(paint); }}><span style:background={paint.hex}></span></button>{/each}
        </div>
        {#if trayOpen}<div class="tray-actions"><button type="button" class="secondary" disabled={!recipe.length} onclick={saveMix}>Save mix</button><button type="button" class="secondary" disabled={!recipe.length} onclick={() => recipe = []}>Empty tray</button></div><p class="palette-caption">{trayReason || 'Your brush picks up the tray as you mix. Parts set how much of each color goes in; streaks get wider with more parts.'} Mixing is approximate.</p>
        {#if savedMixes.length}<div class="saved-mixes" role="group" aria-label="Saved mixes"><span>Saved mixes</span>{#each savedMixes as mix (mix.id)}<button type="button" aria-label={`Refill the tray: ${mix.mode === 'solid' ? 'even mix' : 'streaks'}, ${recipeText(mix.recipe)}`} onclick={() => useMix(mix)}><span class="mini" aria-hidden="true">{#each mix.mode === 'solid' ? [mixColor(mix.recipe)] : expand(mix.recipe).map(dab => dab.hex) as color}<i style:background={color}></i>{/each}</span></button>{/each}</div>{/if}
        {:else}<label class="custom-color">Custom color<input type="color" aria-label="Custom paint color" disabled={!!unavailability(selection.tool, paletteMedium)} value={selection.load?.colors[0] ?? '#ffffff'} oninput={(event) => chooseColor({ name: `Custom ${event.currentTarget.value}`, hex: event.currentTarget.value })} /></label><p class="palette-caption" aria-live="polite">{unavailability(selection.tool, paletteMedium) || (selection.load?.medium === paletteMedium ? selection.load.name : 'Choose a color to load your tool.')}</p>{/if}
      </StudioPanel>
    {/if}
  </div>

  <section bind:this={supplyGrid} class="supplies" aria-label="Art supplies">
    {#each order as id, index (id)}
      {@const supply = supplies.find(supply => supply.id === id)!}
      {@const box = supplyBox(supply)}
      {@const reason = mode === 'arrange' ? '' : supply.id === 'water' ? isBrush(selection.tool) ? '' : 'Choose a brush to dip in water.' : supply.medium && !supply.tool ? unavailability(selection.tool, supply.medium) : ''}
      <div class="supply" data-tool={supply.tool} data-supply={supply.id} class:chosen={active(supply.id)}
        style:--dock-column={index < Math.ceil(order.length / 2) ? index % 2 + 1 : (index - Math.ceil(order.length / 2)) % 2 + 4} style:--dock-row={index < Math.ceil(order.length / 2) ? Math.floor(index / 2) + 1 : Math.floor((index - Math.ceil(order.length / 2)) / 2) + 1} style:left={`${box.x}px`} style:top={`${box.y}px`} style:width={`${box.width}px`} style:height={`${box.height}px`}>
        <PhotoSupply compact={compact || dock !== 'surround'} moving={mode === 'arrange' && !compact && dock === 'surround'} image={supply.id === 'burnisher' ? burnishingPad : asset(supply.id)} label={mode === 'arrange' ? `Move ${supply.name}` : supply.name} selected={mode === 'arrange' ? target === supply.id : active(supply.id)} unavailableReason={reason}
          hit={supply.tip ? [supply.tip[0] / supply.box[2] * 100, supply.tip[1] / supply.box[3] * 100, supply.tip[2] / supply.box[2] * 100, supply.tip[3] / supply.box[3] * 100] : supply.hit ? [(supply.hit[0] - supply.box[0]) / supply.box[2] * 100, (supply.hit[1] - supply.box[1]) / supply.box[3] * 100, supply.hit[2] / supply.box[2] * 100, supply.hit[3] / supply.box[3] * 100] : undefined}
          muted={mode === 'paint' && selection.tool !== null && (!!reason || (!!supply.tool && !active(supply.id)))} onclick={() => openSupply(supply)}
          onpointerdown={(event) => startMove(event, supply)} onpointermove={moveSupply} onpointerup={() => dragging = null} onkeydown={(event) => supplyKey(event, supply.id)} />
      </div>
    {/each}
  </section>
  <div class="sr-only" role="status">{announcement}</div>
</main>

<div id="table-actions" class="table-menu" popover aria-label="Painting table menu">
  {#if menu}<div class="menu-group">{@render menu()}</div>{/if}
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
  .workbench { position: relative; width: 100%; height: 100svh; overflow: clip; isolation: isolate; background-image: linear-gradient(#1e0f0599, #1e0f0599), var(--wood); background-size: auto, 1000px; }
  .status-strip { position: absolute; inset: 0 0 auto; min-height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 10px 20px; background: #0c0806ed; z-index: 40; }
  .mode { display: flex; gap: 4px; }
  .mode button { border: 1px solid #81704f; }
  .mode button[aria-pressed='true'] { background: #e8ddbc; color: #21160d; font-weight: 700; }
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
  .edge { position: absolute; z-index: 3; min-height: 0; padding: 0; border: 0; border-radius: 0; background: transparent; touch-action: none; }
  .edge-top, .edge-bottom { left: 12px; right: 12px; height: 14px; cursor: ns-resize; }
  .edge-left, .edge-right { top: 12px; bottom: 12px; width: 14px; cursor: ew-resize; }
  .edge-top { top: -7px; } .edge-bottom { bottom: -7px; } .edge-left { left: -7px; } .edge-right { right: -7px; }
  .edge::after { content: ''; position: absolute; inset: 5px; border-radius: 2px; background: #f1ec35; opacity: 0; transition: opacity .15s; }
  .edge:hover::after, .edge:focus-visible::after { opacity: .9; }
  .edge:focus-visible { outline: none; }
  .corner { position: absolute; right: -6px; bottom: -6px; z-index: 4; display: grid; place-items: center; width: 32px; height: 32px; min-height: 32px; padding: 0; cursor: nwse-resize; touch-action: none; background: #1c150fe8; }
  @media (prefers-reduced-motion: reduce) { .edge::after { transition: none; } }
  .arranging .supply { z-index: 6; }
  .supply { position: absolute; pointer-events: none; z-index: 2; }
  .supply.chosen { z-index: 4; }
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
  .workspace-menu summary { min-height: 44px; display: flex; align-items: center; padding: 8px 12px; border: 1px solid #9d8c67; border-radius: 4px; cursor: pointer; }
  .workspace-menu label { display: grid; gap: 4px; }
  .workspace-menu p { font-size: 12px; margin: 0; }
  .workspace-menu input { min-height: 44px; width: 100%; background: #17100c; color: #fff5e5; border: 1px solid #9d8c67; }
  .docked:not(.compact) .supplies { position: absolute; top: calc(var(--header-height) + 12px); bottom: 48px; width: min(320px, 27vw); overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; }
  .dock-left:not(.compact) .supplies { left: 12px; }
  .dock-right:not(.compact) .supplies { right: 12px; }
  .dock-both:not(.compact) .supplies { left: 12px; right: 12px; width: auto; grid-template-columns: repeat(2, min(140px, 12vw)) 1fr repeat(2, min(140px, 12vw)); pointer-events: none; }
  .dock-both:not(.compact) .supply { grid-column: var(--dock-column); grid-row: var(--dock-row); }
  .docked:not(.compact) .supply { position: relative; inset: auto !important; width: 100% !important; height: 128px !important; }
  .party-bar { flex: 0 1 auto; min-width: 0; display: flex; justify-content: flex-end; }
  .party-bar:empty { display: none; }
  .header-note { flex: 1 1 12rem; min-width: 0; margin: 0; font-size: 13px; line-height: 1.4; color: #e8ddcc; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .header-note.fresh { color: #fff6e5; font-weight: 700; }
  .menu-button { flex: none; margin-left: auto; min-height: 40px; padding: 6px 16px; font-size: 14px; }
  .account-group :global(.account-controls) { font-size: 13px; }
  .arrange-controls { display: grid; gap: 10px; }
  .arrange-field { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px; font-size: 13px; }
  .arrange-field select { width: 100%; }
  .nudge-pad { display: grid; grid-template-columns: repeat(3, 48px); grid-template-areas: '. up .' 'left down right'; gap: 4px; justify-content: center; }
  .nudge-pad button { padding: 0; font-size: 20px; line-height: 1; }
  .nudge-pad .up { grid-area: up; } .nudge-pad .left { grid-area: left; } .nudge-pad .down { grid-area: down; } .nudge-pad .right { grid-area: right; }
  .arrange-hint { margin: 0; font-size: 12px; line-height: 1.45; }
  .arrange-actions { display: flex; gap: 8px; justify-content: space-between; }
  .workspace-menu > div { display: grid; gap: 8px; padding-top: 8px; }
  .table-menu { position: fixed; inset: 96px 16px auto auto; width: 280px; max-height: calc(100svh - 112px); overflow: auto; margin: 0; background: #21180f; color: #fff5e4; border: 1px solid #aa976a; border-radius: 6px; padding: 14px 16px 16px; box-shadow: 0 10px 28px #000a; }
  .table-menu h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #e8ddcc; margin: 0 0 6px; }
  .menu-group + .menu-group { margin-top: 14px; padding-top: 14px; border-top: 1px solid #5d4d35; }
  .table-menu :global(.menu-group > button), .table-menu :global(.menu-group > a) { display: flex; align-items: center; width: 100%; min-height: 44px; margin: 4px 0; padding: 8px 12px; text-align: left; font: inherit; color: #fff5e5; background: #1c150fe8; border: 1px solid #9d8c67; border-radius: 4px; text-decoration: none; box-sizing: border-box; cursor: pointer; }
  .table-menu :global(.menu-group > button:disabled) { opacity: .5; cursor: default; }
  .table-menu :global(.menu-group > a:hover), .table-menu :global(.menu-group > button:not(:disabled):hover) { background: #2e2316; }
  .table-menu :global(:focus-visible) { outline: 3px solid #f5ed37; outline-offset: 2px; }
  .skip { position: absolute; left: 16px; top: -100px; z-index: 50; padding: 12px; background: #fff5e4; color: #21160d; }
  .skip:focus { top: 100px; }
  .wheel-option { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
  .compact { height: auto; min-height: 100svh; overflow: visible; padding: 0 12px 16px; }
  .compact .status-strip { position: relative; margin: 0 -12px; min-height: 88px; gap: 12px; flex-wrap: wrap; padding: 12px; }
  .compact .mode { flex: 1 0 auto; }
  .compact .selected-tool { flex: 1; min-width: 120px; }
  .compact .selected-color { flex: 1; }
  .compact .canvas-frame { position: relative; inset: auto; width: min(100%, calc(58svh * var(--canvas-aspect))); height: auto; aspect-ratio: var(--canvas-ratio); margin: var(--toolbar-space) auto 32px; }
  .compact .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); align-items: start; gap: 12px; margin-bottom: 16px; }
  .compact .panels:empty { display: none; }
  .compact .supplies { display: grid; grid-template-columns: repeat(auto-fit, minmax(clamp(100px, 13vw, 168px), 1fr)); gap: 12px 8px; }
  .compact .supply { position: relative; inset: auto !important; width: 100% !important; height: clamp(122px, 12vw, 170px) !important; }
  @media (max-width: 600px) { .paint-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } .status-strip { font-size: 12px; } .selected-tool strong { font-size: 18px; } .load-swatch { width: 60px; } }
</style>
