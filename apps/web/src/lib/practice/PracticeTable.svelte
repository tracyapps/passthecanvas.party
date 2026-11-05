<!--
  The practice table (/?practice): the party's painting table with every tool,
  just you, no seats, no timer, no turns. Paint to unwind, try the tools, or
  make images for the site. Download a full-size PNG any time; signed in, save
  it to your practice pieces (image + strokes, so you can keep painting later).
  Practice pieces are private: they never hang in a gallery or show to anyone else.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CANVAS_SHAPES, type CanvasShape, type PaintedStroke, type PracticePiece } from '@ptc/shared';
  import PaintingTable from '../canvas/PaintingTable.svelte';
  import { accountRequest, accountState, accountToken, initializeAccount } from '../account/account.svelte';
  import { dataUrlToBlob, fileSlug, saveFile } from '../download';
  import { loadPreferences, prefs } from '../prefs.svelte';

  let { pieceId = null }: { pieceId?: string | null } = $props();

  // svelte-ignore non_reactive_update — bound once, only called
  let table: PaintingTable;
  let shape = $state<CanvasShape>('classic');
  let title = $state('Practice piece');
  // svelte-ignore state_referenced_locally — the page opens one piece; Save keeps its id
  let savedId = $state<string | null>(pieceId);
  let status = $state('');
  let signedIn = $derived(!!accountState.userId);
  /** The auto-save row this session writes to (a separate copy; never your saved piece). */
  let autosaveId = $state<string | null>(null);

  // ---- what's changed since the last save ----
  // Every stroke (and a title change) bumps the revision. A save or auto-save
  // records the revision it captured; anything newer is "unsaved".
  let revision = 0;
  let capturedRevision = 0;
  let unsaved = $state(false);
  let saveKind = $state<'saving' | 'autosaving' | null>(null);
  let saveError = $state(false);
  let lastSavedAt = $state<Date | null>(null);
  let lastAutosavedAt = $state<Date | null>(null);
  let lastSaveAttempt = Date.now();
  function markChanged() { revision += 1; if (!unsaved) unsaved = true; }
  // A new title is a change too (but loading a piece's title isn't).
  let knownTitle = 'Practice piece';
  $effect(() => { if (title !== knownTitle) { knownTitle = title; markChanged(); } });
  const clock = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  // A clock for "saved 3 min ago", so the indicator stays current on its own.
  let now = $state(Date.now());
  const ago = (date: Date) => { const s = Math.max(0, (now - date.getTime()) / 1000); return s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : clock(date); };
  /** Where saving stands, for the page and for the small indicator by the menu. */
  let saveState = $derived(saveKind ?? (saveError ? 'error' : unsaved ? 'unsaved' : 'clean'));
  let saveStatus = $derived(
    saveKind === 'saving' ? 'Saving…'
    : saveKind === 'autosaving' ? 'Auto-saving…'
    : !signedIn ? (unsaved ? 'Not saved (sign in to save)' : '')
    : saveError && unsaved ? 'Not saved: check your connection'
    : unsaved ? 'Unsaved changes'
    : lastAutosavedAt && (!lastSavedAt || lastAutosavedAt > lastSavedAt) ? `Auto-saved ${ago(lastAutosavedAt)}`
    : lastSavedAt ? `Saved ${ago(lastSavedAt)}` : '');
  /** True when this piece is kept as a picture only (its strokes were too much to keep). Saves stay picture-only. */
  let pictureOnly = false;
  let canvasSize = $derived({ width: CANVAS_SHAPES[shape].width, height: CANVAS_SHAPES[shape].height });
  const canvasKey = 'c1'; // practice strokes use the party's canvas id rules

  const base = () => (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');

  onMount(() => {
    if (pieceId) startLoading('Signing you in…');
    void initializeAccount().then(async () => {
      if (pieceId && accountState.userId) await open(pieceId);
      else if (pieceId) { stopLoading(); say('Sign in to open your practice pieces.'); }
    });
    if (pieceId) starting = false;
    else openChooser(true);
    void loadPreferences();
    // Leaving with unsaved marks asks first (the browser's own prompt).
    const warn = (event: BeforeUnloadEvent) => { if (unsaved) event.preventDefault(); };
    addEventListener('beforeunload', warn);
    // Auto-save: every few minutes (your Settings), only with changes, never mid-stroke.
    const timer = setInterval(() => {
      const minutes = prefs.autosaveMinutes;
      if (!minutes || !signedIn || !unsaved || saveKind || loading || starting || table?.busy()) return;
      if (Date.now() - lastSaveAttempt >= minutes * 60_000) void autosave();
    }, 5_000);
    // Leaving the tab (or the iPad putting it away) is a good moment too: iOS may reload it later.
    const follow = setInterval(() => void followOtherDevices(), 15_000);
    const ticking = setInterval(() => (now = Date.now()), 15_000);
    const back = () => { if (document.visibilityState === 'visible') void followOtherDevices(); };
    document.addEventListener('visibilitychange', back);
    const hidden = () => { if (document.visibilityState === 'hidden' && prefs.autosaveMinutes && signedIn && unsaved && !saveKind && !table?.busy()) void autosave(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { removeEventListener('beforeunload', warn); clearInterval(timer); clearInterval(follow); clearInterval(ticking); document.removeEventListener('visibilitychange', back); document.removeEventListener('visibilitychange', hidden); packer?.terminate(); packer = null; };
  });

  // Opening: anything slower than a moment gets a full-screen progress card.
  let loading = $state<{ shown: boolean; step: string; progress: number | null } | null>(null);
  let loadingTimer: ReturnType<typeof setTimeout> | undefined;
  function startLoading(step: string) {
    loading = { shown: false, step, progress: null };
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => { if (loading) loading.shown = true; }, 600);
  }
  function stopLoading() { clearTimeout(loadingTimer); loading = null; }

  /** Fetch with a progress report (bytes so far, and the total when the server says). */
  async function fetchProgress(url: string, headers: HeadersInit, onProgress: (loaded: number, total: number | null) => void): Promise<Response> {
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok || !response.body) return response;
    const total = Number(response.headers.get('Content-Length')) || null;
    const encoded = !!response.headers.get('Content-Encoding'); // then the length is the compressed size
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, encoded ? null : total);
    }
    return new Response(new Blob(chunks as BlobPart[], { type: response.headers.get('Content-Type') ?? '' }), { status: response.status, headers: response.headers });
  }
  const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

  async function open(id: string) {
    startLoading('Finding your piece…');
    try {
      const pieces = await accountRequest<PracticePiece[]>('community/practice');
      const piece = pieces.find((p) => p.id === id);
      if (!piece) throw new Error('That piece is not in your practice pieces.');
      knownTitle = piece.title;
      title = piece.title;
      shape = piece.shape in CANVAS_SHAPES ? piece.shape as CanvasShape : 'classic';
      // An auto-save keeps saving into itself; Save goes to the piece it came from (or a new one).
      autosaveId = piece.autosave ? piece.id : null;
      savedId = piece.autosave ? piece.draftOf : piece.id;
      await tick();
      await showVersion(piece);
      lastSavedAt = piece.autosave ? null : new Date(piece.updatedAt);
      lastAutosavedAt = piece.autosave ? new Date(piece.updatedAt) : null;
      stopLoading();
      say(`Opened “${piece.title}”. Keep painting.`);
    } catch (cause) {
      stopLoading();
      say(cause instanceof Error ? cause.message : 'That piece could not be opened.');
    }
  }

  /** The newest version of this work shown on the table (server time), to spot saves from other devices. */
  let shownAt = '';
  /** Download one saved version (picture + strokes) and lay it on the table. */
  async function showVersion(piece: PracticePiece) {
    {
      const headers = { Authorization: `Bearer ${await accountToken()}` };
      // The version is in the address so a newer save is never answered from the browser's cache.
      const url = (kind: string) => `${base()}/api/account/community/practice/file?id=${encodeURIComponent(piece.id)}&kind=${kind}&v=${encodeURIComponent(piece.updatedAt)}`;
      // 1. The picture: reopening from it is instant, however much was painted.
      const imageResponse = await fetchProgress(url('image'), headers, (loaded, total) => {
        if (loading) { loading.step = `Downloading the picture… ${megabytes(loaded)}${total ? ` of ${megabytes(total)}` : ''}`; loading.progress = total ? loaded / total : null; }
      });
      if (!imageResponse.ok) throw new Error('That piece could not be opened.');
      const blob = await imageResponse.blob();
      // 2. The strokes: kept as history for the next save (not redrawn).
      let strokes: PaintedStroke[] = [];
      if (piece.hasStrokes) {
        if (loading) { loading.step = 'Getting your brush strokes…'; loading.progress = null; }
        const response = await fetchProgress(url('strokes'), headers, (loaded) => { if (loading) loading.step = `Getting your brush strokes… ${megabytes(loaded)}`; });
        if (response.ok) strokes = await response.json();
      }
      if (loading) { loading.step = 'Laying it on the table…'; loading.progress = null; }
      const picture = await createImageBitmap(blob);
      table.loadPicture('c1', canvasSize.width, canvasSize.height, picture, strokes);
      picture.close();
      pictureOnly = !strokes.length;
      revision = capturedRevision = 0; unsaved = false; saveError = false;
      shownAt = piece.updatedAt;
    }
  }

  /**
   * Saved on your other device? Every 15 seconds (while this tab is showing),
   * look for a newer version of the work on the table: the saved piece, this
   * table's auto-save, or another device's auto-save of the same piece.
   * With no unsaved marks here, the newer version simply appears. With unsaved
   * marks, nothing is replaced; you're told once, and your next save wins.
   */
  let warnedAbout = '';
  async function followOtherDevices() {
    if (document.visibilityState !== 'visible' || !signedIn || (!savedId && !autosaveId) || saveKind || loading || starting || table?.busy()) return;
    try {
      const pieces = await accountRequest<PracticePiece[]>('community/practice');
      const related = pieces.filter((p) => p.id === savedId || p.id === autosaveId || (savedId && p.autosave && p.draftOf === savedId));
      const newest = related.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!newest || !shownAt || newest.updatedAt <= shownAt || saveKind || table?.busy()) return;
      if (unsaved) {
        if (warnedAbout !== newest.updatedAt) { warnedAbout = newest.updatedAt; say(`A newer version was saved on another device at ${clock(new Date(newest.updatedAt))}. Your next save here replaces it.`); }
        return;
      }
      if (newest.title !== title) { knownTitle = newest.title; title = newest.title; }
      await showVersion(newest);
      if (newest.autosave) lastAutosavedAt = new Date(newest.updatedAt); else lastSavedAt = new Date(newest.updatedAt);
      say(`Updated with the version saved on your other device at ${clock(new Date(newest.updatedAt))}.`);
    } catch { /* offline for a moment: try again next time */ }
  }

  // ---- Saving without freezing the page ----
  // Everything heavy happens off the main thread (image encoding, gzip, base64),
  // and strokes are packed incrementally: only those new since the last save.
  // (Done all at once, a save froze an iPad for a second or more, mid-stroke.)
  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('That could not be read.'));
      reader.readAsDataURL(blob);
    });
  }
  function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }
  /** A smaller copy for the practice pieces grid, on paper. */
  async function thumbnail(picture: Blob): Promise<string> {
    const image = await createImageBitmap(picture);
    const scale = 480 / Math.max(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const small = canvas.getContext('2d')!;
    small.fillStyle = '#e1dfda'; // the saved picture is paint only; previews show it on paper
    small.fillRect(0, 0, canvas.width, canvas.height);
    small.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    let blob = await canvasBlob(canvas, 'image/webp', 0.82);
    if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/jpeg', 0.82); // Safari can't always make WebP
    canvas.width = canvas.height = 0; // free it now (iPad Safari)
    if (!blob) throw new Error('The preview could not be made.');
    return blobToDataUrl(blob);
  }

  /** The strokes as JSON, reusing what was already turned into text last time (strokes never change once painted). */
  let packed = { first: null as PaintedStroke | null, count: 0, text: '' };
  function strokesJson(strokes: PaintedStroke[]): string {
    if (strokes[0] !== packed.first || strokes.length < packed.count) packed = { first: strokes[0] ?? null, count: 0, text: '' };
    if (strokes.length > packed.count) {
      const more = strokes.slice(packed.count).map((stroke) => JSON.stringify(stroke)).join(',');
      packed.text = packed.text ? `${packed.text},${more}` : more;
      packed.count = strokes.length;
    }
    return `[${packed.text}]`;
  }
  /** Strokes, gzipped and sent as base64 (they can be big). Done in a worker when possible, so the brush never freezes. */
  let packer: Worker | null | undefined;
  let packerSent = { first: null as PaintedStroke | null, count: 0 };
  let packerJob = 0;
  function packInWorker(strokes: PaintedStroke[]): Promise<string> | null {
    if (packer === undefined) {
      try { packer = new Worker(new URL('./pack-strokes.worker.ts', import.meta.url), { type: 'module' }); } catch { packer = null; }
    }
    if (!packer) return null;
    const worker = packer;
    const reset = strokes[0] !== packerSent.first || strokes.length < packerSent.count;
    if (reset) packerSent = { first: strokes[0] ?? null, count: 0 };
    const add = strokes.slice(packerSent.count); // plain objects, copied to the worker as-is
    const id = ++packerJob;
    return new Promise((resolve, reject) => {
      const done = (event: MessageEvent<{ id: number; packed?: string; error?: string }>) => {
        if (event.data.id !== id) return;
        worker.removeEventListener('message', done);
        worker.removeEventListener('error', failed);
        if (event.data.packed !== undefined) resolve(event.data.packed);
        else { packerSent = { first: null, count: 0 }; reject(new Error(event.data.error)); }
      };
      const failed = () => { worker.removeEventListener('message', done); packer = null; packerSent = { first: null, count: 0 }; reject(new Error('Worker failed.')); };
      worker.addEventListener('message', done);
      worker.addEventListener('error', failed);
      worker.postMessage({ id, reset, add });
      packerSent = { first: strokes[0] ?? null, count: strokes.length };
    });
  }
  async function packStrokes(strokes: PaintedStroke[]): Promise<string | null> {
    if (!strokes.length || typeof CompressionStream === 'undefined') return null;
    const inWorker = packInWorker(strokes);
    if (inWorker) {
      try { return await inWorker; } catch { /* fall back to doing it here */ }
    }
    const gzipped = await new Response(new Blob([strokesJson(strokes)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
    const url = await blobToDataUrl(gzipped);
    return url.slice(url.indexOf(',') + 1);
  }

  /** Picture + preview + strokes, ready to send. */
  async function capture() {
    table.finishStroke();
    const at = revision;
    const strokes = table.strokes();
    // Paint only (see-through paper), so reopening lays it back on the textured paper.
    const picture = await table.snapshotBlob(true);
    const [image, thumb, packedStrokes] = await Promise.all([blobToDataUrl(picture), thumbnail(picture), pictureOnly ? Promise.resolve(null) : packStrokes(strokes)]);
    return { at, image, thumb, strokes: packedStrokes };
  }
  function captured(at: number) {
    capturedRevision = Math.max(capturedRevision, at);
    unsaved = revision !== capturedRevision;
    saveError = false;
    lastSaveAttempt = Date.now();
  }

  async function save() {
    if (!signedIn || saveKind === 'saving') return;
    saveKind = 'saving';
    status = 'Saving…';
    try {
      const piece = await capture();
      const result = await accountRequest<{ id: string; updatedAt: string; strokesKept: boolean | null }>('community/practice', 'PUT', { id: savedId, title: title.trim() || 'Practice piece', shape, image: piece.image, thumb: piece.thumb, strokes: piece.strokes });
      savedId = result.id;
      shownAt = result.updatedAt ?? shownAt;
      captured(piece.at);
      lastSavedAt = new Date();
      history.replaceState(null, '', `/?practice&piece=${result.id}`);
      if (result.strokesKept === false) {
        pictureOnly = true;
        say('Saved as a picture. It had too much detail to keep every stroke, so it reopens as a picture you can keep painting on.');
      } else say('Saved to your practice pieces.');
    } catch (cause) {
      saveError = true;
      say(cause instanceof Error ? cause.message : 'That piece could not be saved. Try downloading it instead.');
    } finally {
      saveKind = null;
    }
  }

  /** A quiet copy into your Auto-saves (never over your saved piece). */
  async function autosave() {
    if (!signedIn || saveKind) return;
    saveKind = 'autosaving';
    lastSaveAttempt = Date.now();
    try {
      const piece = await capture();
      const result = await accountRequest<{ id: string; updatedAt: string }>('community/practice', 'PUT', { id: autosaveId, title: title.trim() || 'Practice piece', shape, image: piece.image, thumb: piece.thumb, strokes: piece.strokes, autosave: true, draftOf: savedId });
      autosaveId = result.id;
      shownAt = result.updatedAt ?? shownAt;
      captured(piece.at);
      lastAutosavedAt = new Date();
      // If the page reloads (iPad Safari does under memory pressure), this brings you back to the newest copy.
      history.replaceState(null, '', `/?practice&piece=${result.id}`);
    } catch {
      saveError = true; // shown by the indicator; the next try is in a few minutes
    } finally {
      saveKind = null;
    }
  }

  async function download() {
    table.finishStroke();
    const outcome = await saveFile(dataUrlToBlob(table.snapshot()), `${fileSlug(title, 'practice-piece')}.png`, title.trim() || 'Practice piece');
    say(outcome === 'cancelled' ? 'Download cancelled.' : outcome === 'shared' ? 'Full-size PNG sent. (“Save Image” puts it in Photos.)' : `Downloaded a full-size PNG (${canvasSize.width} × ${canvasSize.height}).`);
  }

  /** A fresh canvas in the chosen shape. Callers confirm first when there are unsaved marks. */
  async function fresh(next: CanvasShape, name = 'Practice piece') {
    shape = next;
    savedId = null;
    autosaveId = null;
    pictureOnly = false;
    title = knownTitle = name.trim() || 'Practice piece';
    await tick();
    await table.loadHistory('c1', CANVAS_SHAPES[next].width, CANVAS_SHAPES[next].height, [], true, null);
    revision = capturedRevision = 0; unsaved = false; saveError = false; lastSavedAt = lastAutosavedAt = null; lastSaveAttempt = Date.now(); shownAt = '';
    history.replaceState(null, '', '/?practice');
    say(`A fresh ${CANVAS_SHAPES[next].name.toLowerCase()} canvas.`);
  }

  // Choosing the canvas happens once, up front. Changing it later is a deliberate
  // "New canvas" from the menu, because it starts the work over.
  let chooser: HTMLDialogElement;
  let pickShape = $state<CanvasShape>('classic');
  let pickTitle = $state('');
  let starting = $state(true); // the first choice, before any painting
  let dirty = $state(false);
  function openChooser(first = false) {
    starting = first;
    pickShape = shape;
    pickTitle = '';
    dirty = !first && unsaved;
    document.getElementById('table-actions')?.hidePopover();
    chooser.showModal();
  }
  async function confirmChooser(event: SubmitEvent) {
    event.preventDefault();
    chooser.close();
    if (starting && pickShape === shape) { title = knownTitle = pickTitle.trim() || title; starting = false; say(`${CANVAS_SHAPES[shape].name} canvas. Just you and the paints.`); return; }
    starting = false;
    await fresh(pickShape, pickTitle);
  }

  // Short-lived notices (saved, downloaded…), read out politely.
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function say(message: string) {
    status = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (status = ''), 5000);
  }
  const closeMenu = () => document.getElementById('table-actions')?.hidePopover();
</script>

<svelte:head><title>Practice table — Pass the Canvas</title></svelte:head>

<PaintingTable
  bind:this={table}
  canDraw={true}
  painterId="me"
  round={1}
  {canvasKey}
  {canvasSize}
  label={`Practice canvas, ${CANVAS_SHAPES[shape].name}`}
  waitingNote=""
  onstroke={markChanged}
  notice={status}
  {saveStatus}
  {saveState}
  onsave={() => void save()}
>
  {#snippet menu()}
    <h2>This piece</h2>
    <label class="menu-title">Title <input maxlength="80" bind:value={title} /></label>
    {#if signedIn}
      <button type="button" disabled={saveKind === 'saving'} onclick={() => { closeMenu(); void save(); }}>{saveKind === 'saving' ? 'Saving…' : savedId ? 'Save' : 'Save to my pieces'}</button>
    {/if}
    <button type="button" onclick={() => { closeMenu(); void download(); }}>Download PNG</button>
    <button type="button" onclick={() => openChooser()}>New canvas…</button>
    {#if !signedIn}<p class="menu-note">Sign in from Account to save pieces. You can always download.</p>{/if}
  {/snippet}
  {#snippet utility()}
    {#if signedIn}<a href="/account/practice">My practice pieces</a>{/if}
    <a href="/account">My studio</a>
  {/snippet}
</PaintingTable>

<dialog bind:this={chooser} class="chooser" aria-labelledby="chooser-title" oncancel={() => { if (starting) { starting = false; say(`${CANVAS_SHAPES[shape].name} canvas. Just you and the paints.`); } }}>
  <form method="dialog" onsubmit={confirmChooser}>
    <h2 id="chooser-title">{starting ? 'Choose your canvas' : 'Start a new canvas'}</h2>
    {#if starting}<p>Just you and the paints: every tool from the party, no timer. Nothing here is shared.</p>{/if}
    {#if dirty}<p class="warn"><strong>This clears the canvas.</strong> Unsaved marks will be lost, so save or download first if you want to keep them.</p>{/if}
    <fieldset>
      <legend>Canvas shape</legend>
      <div class="shapes">
        {#each Object.entries(CANVAS_SHAPES) as [id, s] (id)}
          <label class="shape">
            <input type="radio" name="shape" value={id} bind:group={pickShape} />
            <span class="preview" aria-hidden="true"><i style:aspect-ratio={`${s.width} / ${s.height}`} style:width={s.width >= s.height ? '100%' : 'auto'} style:height={s.width >= s.height ? 'auto' : '100%'}></i></span>
            <span class="shape-name">{s.name}</span>
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="field">Title <span class="hint">(optional)</span><input maxlength="80" placeholder="Practice piece" bind:value={pickTitle} /></label>
    <div class="actions">
      {#if !starting}<button type="button" onclick={() => chooser.close()}>Keep this canvas</button>{/if}
      {#if dirty && signedIn}<button type="button" onclick={() => { chooser.close(); void save(); }}>Save first</button>{/if}
      <button type="submit" class="primary">{starting ? 'Start painting' : dirty ? 'Clear and start new' : 'Start new canvas'}</button>
    </div>
  </form>
</dialog>

<p class="sr-only" role="status" data-save-state={saveState}>{status}</p>

{#if loading?.shown}
  <!-- Covers the table while a piece opens, so nothing looks broken or half-loaded. -->
  <div class="loading" role="alertdialog" aria-modal="true" aria-labelledby="loading-title" aria-describedby="loading-step">
    <div class="loading-card">
      <h2 id="loading-title">Opening “{title}”</h2>
      <p id="loading-step" aria-live="polite">{loading.step}</p>
      {#if loading.progress !== null}<progress max="1" value={loading.progress} aria-label="Download progress"></progress>{:else}<progress aria-label="Working"></progress>{/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../styles/tokens' as *;

  .menu-title { display: grid; gap: 4px; margin: 4px 0 8px; font-size: 0.8125rem; }
  .menu-title input { min-height: $tap-min; padding: 0 0.5rem; border-radius: 4px; border: 1px solid #9d8c67; background: #17100c; color: $cream; font: inherit; }
  .menu-note { margin: 6px 0 0; font-size: 0.75rem; line-height: 1.45; color: $cream-muted; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #e8ddcc; margin: 0 0 6px; }

  .chooser { width: min(36rem, calc(100vw - 32px)); padding: 1.5rem; border: 1px solid #aa976a; border-radius: 8px; background: #21180f; color: $cream; box-shadow: 0 16px 40px #000c; }
  .chooser::backdrop { background: #0c0806b8; }
  .chooser h2 { font-size: 1.375rem; text-transform: none; letter-spacing: 0; color: $cream; margin: 0 0 0.5rem; }
  .chooser p { margin: 0 0 1rem; line-height: 1.5; color: $cream-muted; }
  .chooser .warn { padding: 0.75rem; border-left: 4px solid #e6a23c; background: #2e2316; color: $cream; }
  fieldset { border: 0; margin: 0 0 1rem; padding: 0; }
  legend { font-weight: 700; margin-bottom: 0.5rem; }
  .shapes { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: 0.5rem; }
  .shape { position: relative; display: grid; justify-items: center; gap: 0.5rem; padding: 0.75rem 0.5rem; border: 1px solid #9d8c67; border-radius: 6px; cursor: pointer; text-align: center; font-size: 0.875rem; }
  .shape input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
  .shape:has(input:checked) { border: 2px solid $cream; background: #2e2316; font-weight: 700; padding: calc(0.75rem - 1px) calc(0.5rem - 1px); }
  .shape:has(input:focus-visible) { outline: 3px solid $focus; outline-offset: 2px; }
  .preview { display: grid; place-items: center; width: 4.5rem; height: 4.5rem; }
  .preview i { display: block; background: #e1dfda; box-shadow: 2px 3px 0 #0007; }
  .field { display: grid; gap: 4px; margin-bottom: 1.25rem; font-weight: 700; }
  .field .hint { font-weight: 400; color: $cream-muted; }
  .field input { min-height: $tap-min; padding: 0 0.625rem; border-radius: 4px; border: 1px solid #9d8c67; background: #17100c; color: $cream; font: inherit; font-weight: 400; }
  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; }
  .actions button { min-height: $tap-min; padding: 0 1rem; border: 1px solid #9d8c67; border-radius: 4px; background: #1c150f; color: $cream; font: inherit; cursor: pointer; }
  .actions .primary { border: 0; border-radius: $radius-pill; background: $cream; color: $walnut-900; font-weight: 700; padding: 0 1.25rem; }
  .chooser :focus-visible { outline: 3px solid $focus; outline-offset: 2px; }

  .loading { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 1rem; background: #0c0806d9; }
  .loading-card { width: min(26rem, 100%); padding: 1.5rem; border: 1px solid #aa976a; border-radius: 8px; background: #21180f; color: $cream; box-shadow: 0 16px 40px #000c; }
  .loading-card h2 { font-size: 1.25rem; text-transform: none; letter-spacing: 0; color: $cream; margin: 0 0 .5rem; overflow-wrap: anywhere; }
  .loading-card p { margin: 0 0 1rem; color: $cream-muted; line-height: 1.5; }
  .loading-card progress { width: 100%; height: 10px; accent-color: #eee935; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
