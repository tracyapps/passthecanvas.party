<script lang="ts">
  import { onMount, tick } from 'svelte';
  import AccountControls from '../account/AccountControls.svelte';
  import { accountState, loadAccountWorkspaces, saveAccountWorkspaces } from '../account/account.svelte';
  import PhotoSupply from './PhotoSupply.svelte';
  import StudioPanel from './StudioPanel.svelte';
  import StudyCanvas from './StudyCanvas.svelte';
  import { STUDY_PALETTES } from './study-palettes';
  import { defaultLayout, decodeWorkspaces, gridDestination, WORKSPACE_KEY, type WorkspaceLayout, type SavedWorkspace, type ToolDock } from './study-workspaces';
  import burnishingPad from './burnishing-pad.svg?url';
  import { constrainSupply, type SupplyRect } from './study-placement';
  import { emptySelection, selectTool, loadPaint, dipInWater, isBrush, unavailability,
    TOOL_NAMES, MEDIUM_NAMES, type PaintingTool, type PaintingMedium, type PaintLoad } from './painting-selection';
  const images = import.meta.glob('../../../../../_design/mockups/asset-review/study-*.{svg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
  function asset(name: string, extension = 'svg'): string { return images[`../../../../../_design/mockups/asset-review/study-${name}.${extension}`] ?? ''; }
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
  let canvasDialog: HTMLDialogElement;
  let exportReplay = $state<(() => void)>();
  let dock = $state<ToolDock>('surround');
  let rotation = $state(0);
  let viewReset = $state(0);
  let toolbarHeight = $state(110);
  let frameOverride = $state<{ width: number; height: number } | null>(null);
  let frameActual = $state({ width: 800, height: 425 });
  let documentSize = $state({ width: 1600, height: 850 });
  let nextSize = $state('landscape');
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
  const canvasSizes: Record<string, { name: string; width: number; height: number }> = {
    landscape: { name: 'Wide landscape', width: 1600, height: 850 },
    portrait: { name: 'Tall portrait', width: 850, height: 1600 },
    square: { name: 'Square', width: 1200, height: 1200 },
    classic: { name: 'Classic landscape', width: 1600, height: 1200 }
  };
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
  let resetVersion = $state(0);
  let painterId = $state('1');
  let wheelZoom = $state(false);
  let settingsOpen = $state(true);
  let paletteOpen = $state(false);
  let paletteMedium = $state<PaintingMedium>('acrylic');
  let trayOpen = $state(false);
  let dabs = $state<{ name: string; hex: string }[]>([]);
  let trayMode = $state<'solid' | 'multicolor'>('multicolor');
  let trayMedium = $state<'acrylic' | 'watercolor'>('acrylic');
  let announcement = $state('');
  let confirmationDialog: HTMLDialogElement;
  let target = $state('acrylic');
  let positions = $state<Record<string, { x: number; y: number }>>({});
  let dragging: { id: string; x: number; y: number; left: number; top: number; pointer: number } | null = null;
  let toolName = $derived(selection.tool ? TOOL_NAMES[selection.tool] : 'None');
  let status = $derived(mode === 'arrange' ? 'Canvas locked. Arrange supplies or explore the artwork.' : !selection.tool ? 'Choose a tool to begin.'
    : selection.tool === 'burnisher' ? 'Smudge & intensify. Only your own layers will change.'
    : selection.tool === 'eraser' || selection.tool === 'sponge' ? 'Ready. Only your own layers will change.'
    : selection.load ? `${selection.load.name}${selection.wet ? ', with water' : ''}. Ready to paint.`
    : selection.wet ? 'Water only. Only your own layers will change.' : 'Choose a compatible paint to load your tool.');
  let trayReason = $derived(unavailability(selection.tool, trayMedium));
  let solidColor = $derived(averageColor(dabs.map(dab => dab.hex)));
  let availableColors = $derived(STUDY_PALETTES[trayOpen ? trayMedium : paletteMedium]);
  let canvasBox = $derived.by(() => {
    const top = headerHeight + toolbarHeight + 32;
    const left = dock === 'right' ? 24 : dock === 'left' || dock === 'both' ? Math.min(360, board.width * .3) : paletteOpen ? 456 : board.width * 0.18;
    const scale = Math.min(board.width / 1440, board.height / 1024);
    const rightRail = dock === 'right' || dock === 'both' ? Math.min(360, board.width * .3) : dock === 'left' ? 24 : Math.max(board.width * 0.12, 260 * scale + 40);
    const available = Math.max(300, board.width - left - rightRail);
    const settingsSpace = dock !== 'surround' ? 90 : hasIntensity && settingsOpen ? 360 : 270;
    const width = Math.min(available, Math.max(260, (board.height - top - settingsSpace) * documentSize.width / documentSize.height));
    return { x: left + (available - width) / 2, y: top, width };
  });
  onMount(() => {
    board = { width: bench.clientWidth, height: bench.clientHeight };
    headerHeight = statusStrip.clientHeight;
    const observer = new ResizeObserver(() => { board = { width: bench.clientWidth, height: bench.clientHeight }; });
    observer.observe(bench);
    const frameObserver = new ResizeObserver(() => { frameActual = { width: canvasFrame.clientWidth, height: canvasFrame.clientHeight }; });
    frameObserver.observe(canvasFrame);
    const headerObserver = new ResizeObserver(() => headerHeight = statusStrip.clientHeight);
    headerObserver.observe(statusStrip);
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (raw) { const stored = decodeWorkspaces(raw, supplies.map(item => item.id)); savedViews = stored.views; selectedView = stored.selected; applyLayout(stored.current); }
    } catch { storageError = 'Saved views could not be read. Existing browser data has been kept.'; }
    storageReady = true;
    return () => { observer.disconnect(); frameObserver.disconnect(); headerObserver.disconnect(); };
  });
  function currentLayout(): WorkspaceLayout { return { positions: $state.snapshot(positions), order: [...order], dock, frame: frameOverride ? { width: frameOverride.width / windowWidth, height: frameOverride.height / windowHeight } : null, rotation }; }
  function applyLayout(layout: WorkspaceLayout) {
    positions = $state.snapshot(layout.positions); order = [...layout.order]; dock = layout.dock; rotation = layout.rotation;
    frameOverride = layout.frame ? { width: layout.frame.width * windowWidth, height: layout.frame.height * windowHeight } : null;
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
  function resizeWindow(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const maxWidth = compact ? Math.max(260, windowWidth - 24) : Math.max(260, board.width - canvasBox.x - (dock === 'right' || dock === 'both' ? Math.min(360, board.width * .3) : 16));
    const maxHeight = compact ? windowHeight * 1.3 : Math.max(200, board.height - canvasBox.y - 64);
    frameOverride = { width: Math.max(260, Math.min(maxWidth, width)), height: Math.max(200, Math.min(maxHeight, height)) };
  }
  function changeCanvas() {
    const chosen = canvasSizes[nextSize];
    documentSize = { width: chosen.width, height: chosen.height }; rotation = 0; frameOverride = null; resetVersion += 1; viewReset += 1; canvasDialog.close();
    announcement = `${chosen.name}, ${chosen.width} by ${chosen.height}. New practice canvas.`;
  }
  function averageColor(colors: string[]): string {
    if (!colors.length) return '#f6f3ea';
    let result = '#';
    for (const start of [1, 3, 5]) {
      let total = 0;
      for (const color of colors) total += parseInt(color.slice(start, start + 2), 16);
      result += Math.round(total / colors.length).toString(16).padStart(2, '0');
    }
    return result;
  }
  function putDown() {
    selection = { ...selection, tool: null, load: null, wet: false };
    paletteOpen = false;
    announcement = 'Tool put down. The artwork is unchanged.';
  }
  function globalKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (confirmationDialog?.open || canvasDialog?.open) return;
    putDown();
  }
  function emptySpace(event: MouseEvent) { if (event.target === bench && !dragging) putDown(); }
  function select(tool: PaintingTool) {
    selection = selectTool(selection, tool);
    settingsOpen = true;
    announcement = `${TOOL_NAMES[tool]}. ${status}`;
  }
  function active(id: string): boolean {
    if (id === 'water') return selection.wet;
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
  function loadTray() {
    if (!dabs.length || trayReason) return;
    const load: PaintLoad = { medium: trayMedium, name: `Tray: ${trayMode === 'solid' ? 'even mix' : 'multicolor'}, ${dabs.length} colors`, colors: trayMode === 'solid' ? [solidColor] : dabs.map(dab => dab.hex) };
    selection = loadPaint(selection, load);
    announcement = `${toolName} loaded from the color tray.`;
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
    const frame = { x: canvasBox.x - 12, y: canvasBox.y - 110, width: frameActual.width + 24, height: frameActual.height + 90 };
    return constrainSupply({ x, y, width, height }, { x: 8, y: headerHeight + 8, width: board.width - 16, height: Math.max(200, board.height - headerHeight - 32) }, tip, frame);
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
<main bind:this={bench} class="workbench" class:compact class:docked={dock !== 'surround'} class:dock-left={dock === 'left'} class:dock-right={dock === 'right'} class:dock-both={dock === 'both'} style:--wood={`url('${asset('wood', 'webp')}')`} style:--header-height={`${headerHeight}px`}>
  <a class="skip" href="#practice-canvas">Skip to canvas</a>
  <header bind:this={statusStrip} class="status-strip">
    <div class="mode" role="group" aria-label="Workspace mode">
      <button type="button" aria-pressed={mode === 'paint'} onclick={() => mode = 'paint'}>Paint</button>
      <button type="button" aria-pressed={mode === 'arrange'} onclick={() => { mode = 'arrange'; paletteOpen = false; }}>Arrange &amp; view</button>
    </div>
    {#if mode === 'arrange'}
      <section class="arrange-controls" aria-label="Arrange supplies">
        <label>Move supply<select bind:value={target}>{#each supplies as supply}<option value={supply.id}>{supply.name}</option>{/each}</select></label>
        <div><button type="button" onclick={() => nudge(-32, 0)}>Left</button><button type="button" onclick={() => nudge(32, 0)}>Right</button><button type="button" onclick={() => nudge(0, -32)}>Up</button><button type="button" onclick={() => nudge(0, 32)}>Down</button><button type="button" onclick={() => { applyLayout(defaultLayout(supplies.map(supply => supply.id))); selectedView = '';  }}>Reset layout</button></div>
        <label class="dock-choice">Tools<select aria-label="Tool placement" bind:value={dock}><option value="surround">Around canvas</option><option value="both">Columns both sides</option><option value="left">Columns on left</option><option value="right">Columns on right</option></select></label>
        <details class="workspace-menu"><summary>Saved views</summary><div><p>{accountState.userId ? 'Views are linked to your signed-in account.' : 'Saved on this browser. Sign in through Menu for account saving.'}</p><label>Saved view<select aria-label="Saved view" value={activeViewValue} onchange={(event) => loadView(event.currentTarget.value)}><option value="">Current arrangement</option>{#each savedViews as saved}<option value={saved.id}>{saved.name}</option>{/each}</select></label><label>View name<input aria-label="View name" maxlength="80" bind:value={viewName} /></label><button type="button" onclick={saveView}>Save as new view</button><button type="button" disabled={!selectedView} onclick={() => { savedViews = savedViews.map(view => view.id === selectedView ? { ...view, layout: currentLayout() } : view); announcement = 'Saved view updated.'; }}>Update saved view</button><button type="button" disabled={!selectedView} onclick={() => { savedViews = savedViews.filter(view => view.id !== selectedView); selectedView = ''; }}>Delete saved view</button>{#if accountState.userId}<button type="button" disabled={accountSyncing || !cloudLoaded} onclick={() => void saveCloud()}>Save views to account</button><button type="button" disabled={accountSyncing} onclick={() => void restoreAccount(accountState.userId)}>Reload account views</button><button type="button" disabled={accountSyncing || !cloudLoaded} onclick={importBrowserViews}>Import browser views to account</button>{/if}<p role="status">{storageError || accountMessage || 'Your latest arrangement is restored automatically.'}</p></div></details>
        <small>{compact || dock !== 'surround' ? 'Use the buttons to reorder supplies.' : 'Drag supplies, or move them with these buttons.'} Painting is locked.</small>
      </section>
    {:else}
    <div class="selected-tool"><span>Tool selected</span><strong>{toolName}</strong></div>
    <div class="selected-color"><span>Current color</span><div class="load-line"><span class="load-swatch" class:empty={!selection.load} aria-hidden="true">{#each selection.load?.colors ?? [] as color}<i style:background={color}></i>{/each}</span><strong>{selection.load ? MEDIUM_NAMES[selection.load.medium] : selection.wet ? 'Water only' : selection.tool === 'eraser' || selection.tool === 'sponge' || selection.tool === 'burnisher' ? 'Not needed' : 'Unloaded'}</strong></div></div>
    {/if}
    <button type="button" class="secondary" popovertarget="table-actions" aria-label="Painting table menu">Menu</button>
  </header>

  <section bind:this={canvasFrame} class="canvas-frame" id="practice-canvas" aria-label="Practice painting"
    style:--toolbar-space={`${toolbarHeight + 28}px`} style:--surface={`url('${asset('surface')}')`} style:--canvas-x={`${canvasBox.x}px`} style:--canvas-y={`${canvasBox.y}px`} style:--canvas-width={`${canvasBox.width}px`} style:--canvas-ratio={`${documentSize.width} / ${documentSize.height}`} style:--canvas-aspect={documentSize.width / documentSize.height} style:width={frameOverride ? `${Math.min(frameOverride.width, compact ? windowWidth - 24 : board.width - canvasBox.x - (dock === 'right' || dock === 'both' ? Math.min(360, board.width * .3) : 16))}px` : undefined} style:height={frameOverride ? `${Math.min(frameOverride.height, compact ? windowHeight * 1.3 : Math.max(200, board.height - canvasBox.y - 64))}px` : undefined}>
    <StudyCanvas {selection} {size} intensity={intensity / 100} {resetVersion} {mode} {painterId} {wheelZoom} documentWidth={documentSize.width} documentHeight={documentSize.height} baseWidth={compact ? Math.min(board.width - 24, windowHeight * .58 * documentSize.width / documentSize.height) : canvasBox.width} bind:rotation fitVersion={viewReset} ontoolbarheight={(height) => toolbarHeight = height} onresizewindow={resizeWindow} onnewcanvas={() => canvasDialog.showModal()} onexportready={(download) => exportReplay = download} />
    <p class="canvas-hint">{status}</p>
  </section>

  <div class="panels">
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
          <div class="mixing-well" style:background-image={`url('${asset('tray')}')`} aria-label={`${dabs.length} colors in the mixing area`}>
            {#each dabs as dab, index}<button type="button" class="dab" style:background={trayMode === 'solid' ? solidColor : dab.hex} style:left={`${25 + index % 3 * 16}%`} style:top={`${20 + Math.floor(index / 3) * 21}%`} aria-label={`Remove ${dab.name} from tray`} onclick={() => dabs = dabs.filter((_, position) => position !== index)}></button>{/each}
          </div>
          <fieldset class="tray-options"><legend>In this tray</legend><label><input type="radio" bind:group={trayMode} value="multicolor" /> Keep colors separate</label><label><input type="radio" bind:group={trayMode} value="solid" /> Mix evenly</label></fieldset>
          <label class="medium-choice">Medium<select bind:value={trayMedium}><option value="acrylic">Acrylic</option><option value="watercolor">Watercolor</option></select></label>
        {:else}<label class="medium-choice">Paint set<select value={paletteMedium} onchange={(event) => changePalette(event.currentTarget.value as PaintingMedium)}>{#each Object.entries(MEDIUM_NAMES) as [medium, name]}<option value={medium}>{name}</option>{/each}</select></label><p class="palette-caption">{#if paletteMedium === 'pencil' || paletteMedium === 'charcoal'}{availableColors.length} colors · pictured shades plus extra studio colors.{:else}{availableColors.length} colors from the pictured {MEDIUM_NAMES[paletteMedium].toLowerCase()} set.{/if}</p>{/if}
        <div class="paint-grid" role="group" aria-label={trayOpen ? 'Add colors to mixing area' : `${MEDIUM_NAMES[paletteMedium]} colors`}>
          {#each availableColors as paint}<button type="button" title={paint.name} aria-label={paint.name} aria-pressed={!trayOpen && selection.load?.name === paint.name} disabled={trayOpen ? dabs.length >= 9 : !!unavailability(selection.tool, paletteMedium)} onclick={() => { if (trayOpen) dabs = [...dabs, paint]; else chooseColor(paint); }}><span style:background={paint.hex}></span></button>{/each}
        </div>
        {#if trayOpen}<div class="tray-actions"><button type="button" class="primary" disabled={!dabs.length || !!trayReason} onclick={loadTray}>Load {trayMode === 'solid' ? 'even mix' : 'multicolor swatch'}</button><button type="button" class="secondary" disabled={!dabs.length} onclick={() => dabs = []}>Empty tray</button></div><p class="palette-caption">{trayReason || 'Tap a dab to remove it. Both modes keep your colors.'} Mixing remains approximate.</p>
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
  <footer><span>Local practice · Painter {painterId} · other painters protected</span><a href="/">Back to party</a></footer>
  <div class="sr-only" role="status">{announcement}</div>
</main>

<div id="table-actions" popover><h2>Painting table</h2><AccountControls />
  <button type="button" disabled={!selection.tool} onclick={() => { document.getElementById('table-actions')?.hidePopover(); void showSettings(); }}>Tool settings</button>
  <button type="button" onclick={() => { putDown(); document.getElementById('table-actions')?.hidePopover(); }}>Put tool down</button>
  <button type="button" disabled={!exportReplay} onclick={() => { exportReplay?.(); document.getElementById('table-actions')?.hidePopover(); }}>Export stroke recording</button>
  <label class="wheel-option"><input type="checkbox" bind:checked={wheelZoom} /> Scroll wheel zooms canvas</label>
  <button type="button" onclick={() => { painterId = painterId === '1' ? '2' : '1'; putDown(); document.getElementById('table-actions')?.hidePopover(); announcement = `Practice painter ${painterId}. Other painters' marks are protected.`; }}>Switch practice painter</button>
  <button type="button" onclick={() => { document.getElementById('table-actions')?.hidePopover(); confirmationDialog.showModal(); }}>Clear practice canvas…</button><p>Changes stay here until you reload.</p>
</div>
<dialog bind:this={canvasDialog} aria-labelledby="canvas-choice-title"><h2 id="canvas-choice-title">Choose a canvas</h2><p>This starts a new local painting and clears the current practice marks. View rotation never changes the artwork's dimensions.</p><label>Canvas dimensions<select aria-label="Canvas dimensions" bind:value={nextSize}>{#each Object.entries(canvasSizes) as [id, canvas]}<option value={id}>{canvas.name} · {canvas.width} × {canvas.height}</option>{/each}</select></label><div class="tray-actions"><button type="button" onclick={() => canvasDialog.close()}>Keep current canvas</button><button type="button" onclick={changeCanvas}>Start new canvas</button></div></dialog>
<dialog bind:this={confirmationDialog} aria-labelledby="clear-title"><h2 id="clear-title">Clear the practice canvas?</h2><p>This clears all local practice painters.</p><div class="tray-actions"><button type="button" class="secondary" onclick={() => confirmationDialog.close()}>Keep painting</button><button type="button" class="primary" onclick={() => { resetVersion += 1; confirmationDialog.close(); }}>Clear canvas</button></div></dialog>

<style lang="scss">
  @use '../../styles/tokens' as *;
  .filter-defs { position: absolute; pointer-events: none; }
  .workbench { position: relative; width: 100%; height: 100svh; overflow: clip; isolation: isolate; background-image: linear-gradient(#1e0f0599, #1e0f0599), var(--wood); background-size: auto, 1000px; }
  .status-strip { position: absolute; inset: 0 0 auto; min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 12px 20px; background: #0c0806ed; z-index: 40; }
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
  .canvas-frame { position: absolute; left: var(--canvas-x); top: var(--canvas-y); width: var(--canvas-width); aspect-ratio: var(--canvas-ratio); background: transparent; z-index: 5; }
  .canvas-hint { position: absolute; top: calc(100% + 22px); left: 0; right: 0; text-align: center; pointer-events: none; font-size: 13px; margin: 0; color: #fff4df; text-shadow: 0 2px 3px #000; }
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
  .dab { position: absolute; width: 44px; height: 44px; min-width: 44px; padding: 0; border-radius: 50%; border: 1px solid #3a2a1a; box-shadow: 1px 3px 4px #0005; }
  .tray-options { display: flex; gap: 12px; flex-wrap: wrap; border: 0; padding: 0; font-size: 12px; }
  .tray-options label, .medium-choice { display: flex; gap: 8px; align-items: center; min-height: 44px; }
  .tray-options input { width: 18px; height: 18px; accent-color: #e6df54; }
  .medium-choice { font-size: 12px; margin-top: 6px; }
  .tray-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .arrange-controls { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
  .arrange-controls label { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .arrange-controls > div { display: flex; flex-wrap: wrap; gap: 4px; }
  .arrange-controls button { min-width: 44px; }
  .workspace-menu { position: relative; }
  .workspace-menu summary { min-height: 44px; display: flex; align-items: center; padding: 8px 12px; border: 1px solid #9d8c67; border-radius: 4px; cursor: pointer; }
  .workspace-menu > div { position: absolute; top: 48px; right: 0; width: min(330px, calc(100vw - 24px)); padding: 12px; display: grid; gap: 8px; background: #21180f; border: 1px solid #9d8c67; box-shadow: 0 8px 20px #0009; z-index: 45; }
  .workspace-menu label { display: grid; gap: 4px; }
  .workspace-menu p { font-size: 12px; margin: 0; }
  .workspace-menu input { min-height: 44px; width: 100%; background: #17100c; color: #fff5e5; border: 1px solid #9d8c67; }
  .dock-choice select { max-width: 170px; }
  .docked:not(.compact) .supplies { position: absolute; top: calc(var(--header-height) + 12px); bottom: 48px; width: min(320px, 27vw); overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; }
  .dock-left:not(.compact) .supplies { left: 12px; }
  .dock-right:not(.compact) .supplies { right: 12px; }
  .dock-both:not(.compact) .supplies { left: 12px; right: 12px; width: auto; grid-template-columns: repeat(2, min(140px, 12vw)) 1fr repeat(2, min(140px, 12vw)); pointer-events: none; }
  .dock-both:not(.compact) .supply { grid-column: var(--dock-column); grid-row: var(--dock-row); }
  .docked:not(.compact) .supply { position: relative; inset: auto !important; width: 100% !important; height: 128px !important; }
  .arrange-controls small { flex-basis: 100%; font-size: 12px; }
  footer { position: absolute; bottom: 2px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; pointer-events: none; color: #fff5df; z-index: 10; }
  footer a { min-height: 44px; display: inline-flex; align-items: center; pointer-events: auto; color: #fff5df; }
  .skip { position: absolute; left: 16px; top: -100px; z-index: 50; padding: 12px; background: #fff5e4; color: #21160d; }
  .skip:focus { top: 100px; }
  #table-actions { position: fixed; inset: 96px 16px auto auto; width: 270px; background: #21180f; color: #fff5e4; border: 1px solid #aa976a; padding: 16px; }
  #table-actions h2 { font-size: 20px; margin: 0 0 12px; }
  #table-actions button { display: block; width: 100%; text-align: left; margin: 4px 0; }
  #table-actions p { font-size: 12px; }
  .wheel-option { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 13px; }
  dialog { padding: 24px; background: #21180f; color: #fff5e4; border: 1px solid #aa976a; max-width: calc(100vw - 24px); }
  dialog::backdrop { background: #0009; }
  .compact { height: auto; min-height: 100svh; overflow: visible; padding: 0 12px 16px; }
  .compact .status-strip { position: relative; margin: 0 -12px; min-height: 88px; gap: 12px; flex-wrap: wrap; padding: 12px; }
  .compact .workspace-menu > div { position: fixed; top: calc(var(--header-height) + 8px); left: 12px; right: 12px; width: auto; max-height: 65svh; overflow: auto; }
  .compact .mode { flex: 1 0 auto; }
  .compact .selected-tool { flex: 1; min-width: 120px; }
  .compact .selected-color { flex: 1; }
  .compact .canvas-frame { position: relative; inset: auto; width: min(100%, calc(58svh * var(--canvas-aspect))); margin: var(--toolbar-space) auto 64px; }
  .compact .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr)); align-items: start; gap: 12px; margin-bottom: 16px; }
  .compact .panels:empty { display: none; }
  .compact .supplies { display: grid; grid-template-columns: repeat(auto-fit, minmax(clamp(100px, 13vw, 168px), 1fr)); gap: 12px 8px; }
  .compact .supply { position: relative; inset: auto !important; width: 100% !important; height: clamp(122px, 12vw, 170px) !important; }
  .compact footer { position: relative; inset: auto; margin-top: 12px; pointer-events: auto; }
  .compact .arrange-controls { flex-basis: 100%; order: 1; }
  @media (max-width: 600px) { .paint-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } .status-strip { font-size: 12px; } .selected-tool strong { font-size: 18px; } .load-swatch { width: 60px; } }
</style>
