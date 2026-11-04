<!--
  The practice table (/?practice): the party's painting table with every tool,
  just you, no seats, no timer, no turns. Paint to unwind, try the tools, or
  make images for the site. Download a full-size PNG any time; signed in, save
  it to your practice pieces (image + strokes, so you can keep painting later).
  Practice pieces are private: they never hang in a gallery or show to anyone else.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { CANVAS_SHAPES, type CanvasShape, type PaintedStroke } from '@ptc/shared';
  import PaintingTable from '../canvas/PaintingTable.svelte';
  import { accountRequest, accountState, accountToken, initializeAccount } from '../account/account.svelte';
  import { dataUrlToBlob, fileSlug, saveFile } from '../download';

  let { pieceId = null }: { pieceId?: string | null } = $props();

  // svelte-ignore non_reactive_update — bound once, only called
  let table: PaintingTable;
  let shape = $state<CanvasShape>('classic');
  let title = $state('Practice piece');
  // svelte-ignore state_referenced_locally — the page opens one piece; Save keeps its id
  let savedId = $state<string | null>(pieceId);
  let status = $state('');
  let saving = $state(false);
  let savedCount = 0; // strokes in the last saved (or loaded) version
  /** True when this piece is kept as a picture only (its strokes were too much to keep). Saves stay picture-only. */
  let pictureOnly = false;
  let canvasSize = $derived({ width: CANVAS_SHAPES[shape].width, height: CANVAS_SHAPES[shape].height });
  const canvasKey = 'c1'; // practice strokes use the party's canvas id rules

  const base = () => (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');
  let signedIn = $derived(!!accountState.userId);

  onMount(() => {
    void initializeAccount().then(async () => {
      if (pieceId && accountState.userId) await open(pieceId);
    });
    if (pieceId) starting = false;
    else openChooser(true);
    // Leaving with unsaved marks asks first (the browser's own prompt).
    const warn = (event: BeforeUnloadEvent) => {
      if (table && table.strokes().length !== savedCount) event.preventDefault();
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  });

  async function open(id: string) {
    status = 'Opening your piece…';
    try {
      const pieces = await accountRequest<{ id: string; title: string; shape: CanvasShape; hasStrokes: boolean }[]>('community/practice');
      const piece = pieces.find((p) => p.id === id);
      if (!piece) throw new Error('That piece is not in your practice pieces.');
      title = piece.title;
      shape = piece.shape in CANVAS_SHAPES ? piece.shape : 'classic';
      await tick();
      let strokes: PaintedStroke[] = [];
      const headers = { Authorization: `Bearer ${await accountToken()}` };
      const url = (kind: string) => `${base()}/api/account/community/practice/file?id=${encodeURIComponent(id)}&kind=${kind}`;
      if (piece.hasStrokes) {
        const response = await fetch(url('strokes'), { headers });
        if (response.ok) strokes = await response.json();
      }
      if (strokes.length) {
        pictureOnly = false;
        await table.loadHistory('c1', canvasSize.width, canvasSize.height, strokes, true, null);
      } else {
        // Kept as a picture: it becomes the paper you keep painting on.
        const response = await fetch(url('image'), { headers });
        if (!response.ok) throw new Error('That piece could not be opened.');
        const picture = URL.createObjectURL(await response.blob());
        try { await table.loadHistory('c1', canvasSize.width, canvasSize.height, [], false, picture); }
        finally { URL.revokeObjectURL(picture); }
        pictureOnly = true;
      }
      savedCount = table.strokes().length;
      say(`Opened “${piece.title}”. Keep painting.`);
    } catch (cause) {
      say(cause instanceof Error ? cause.message : 'That piece could not be opened.');
    }
  }

  /** A smaller copy for the practice pieces grid. */
  async function thumbnail(png: string): Promise<string> {
    const image = new Image();
    image.src = png;
    await image.decode();
    const scale = 480 / Math.max(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.82);
  }

  /** Strokes, gzipped in the browser and sent as base64 (they can be big). */
  async function packStrokes(strokes: PaintedStroke[]): Promise<string | null> {
    if (!strokes.length || typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([JSON.stringify(strokes)]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  async function save() {
    if (!signedIn) return;
    saving = true;
    status = 'Saving…';
    try {
      table.finishStroke();
      const image = table.snapshot();
      const strokes = table.strokes();
      const result = await accountRequest<{ id: string; strokesKept: boolean | null }>('community/practice', 'PUT', { id: savedId, title: title.trim() || 'Practice piece', shape, image, thumb: await thumbnail(image), strokes: pictureOnly ? null : await packStrokes(strokes) });
      savedId = result.id;
      savedCount = strokes.length;
      history.replaceState(null, '', `/?practice&piece=${result.id}`);
      if (result.strokesKept === false) {
        pictureOnly = true;
        say('Saved as a picture. It had too much detail to keep every stroke, so it reopens as a picture you can keep painting on.');
      } else say('Saved to your practice pieces.');
    } catch (cause) {
      say(cause instanceof Error ? cause.message : 'That piece could not be saved. Try downloading it instead.');
    } finally {
      saving = false;
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
    pictureOnly = false;
    title = name.trim() || 'Practice piece';
    await tick();
    await table.loadHistory('c1', CANVAS_SHAPES[next].width, CANVAS_SHAPES[next].height, [], true, null);
    savedCount = 0;
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
    dirty = !first && !!table && table.strokes().length !== savedCount;
    document.getElementById('table-actions')?.hidePopover();
    chooser.showModal();
  }
  async function confirmChooser(event: SubmitEvent) {
    event.preventDefault();
    chooser.close();
    if (starting && pickShape === shape) { title = pickTitle.trim() || title; starting = false; say(`${CANVAS_SHAPES[shape].name} canvas. Just you and the paints.`); return; }
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
  onstroke={() => {}}
  notice={status}
>
  {#snippet menu()}
    <h2>This piece</h2>
    <label class="menu-title">Title <input maxlength="80" bind:value={title} /></label>
    {#if signedIn}
      <button type="button" disabled={saving} onclick={() => { closeMenu(); void save(); }}>{saving ? 'Saving…' : savedId ? 'Save' : 'Save to my pieces'}</button>
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

<p class="sr-only" role="status">{status}</p>

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

  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
