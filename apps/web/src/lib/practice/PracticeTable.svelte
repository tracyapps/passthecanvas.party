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

  let { pieceId = null }: { pieceId?: string | null } = $props();

  // svelte-ignore non_reactive_update — bound once, only called
  let table: PaintingTable;
  let shape = $state<CanvasShape>('classic');
  let title = $state('Practice piece');
  // svelte-ignore state_referenced_locally — the page opens one piece; Save keeps its id
  let savedId = $state<string | null>(pieceId);
  let status = $state('');
  let saving = $state(false);
  let confirmNew = $state(false);
  let savedCount = 0; // strokes in the last saved (or loaded) version
  let canvasSize = $derived({ width: CANVAS_SHAPES[shape].width, height: CANVAS_SHAPES[shape].height });
  const canvasKey = 'c1'; // practice strokes use the party's canvas id rules

  const base = () => (import.meta.env.VITE_ACCOUNT_API_URL ?? '').replace(/\/$/, '');
  let signedIn = $derived(!!accountState.userId);

  onMount(() => {
    void initializeAccount().then(async () => {
      if (pieceId && accountState.userId) await open(pieceId);
    });
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
      if (piece.hasStrokes) {
        const response = await fetch(`${base()}/api/account/community/practice/file?id=${encodeURIComponent(id)}&kind=strokes`, { headers: { Authorization: `Bearer ${await accountToken()}` } });
        if (response.ok) strokes = await response.json();
      }
      await table.loadHistory('c1', canvasSize.width, canvasSize.height, strokes, true, null);
      savedCount = table.strokes().length;
      status = `Opened “${piece.title}”. Keep painting.`;
    } catch (cause) {
      status = cause instanceof Error ? cause.message : 'That piece could not be opened.';
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
      const result = await accountRequest<{ id: string }>('community/practice', 'PUT', { id: savedId, title: title.trim() || 'Practice piece', shape, image, thumb: await thumbnail(image), strokes: await packStrokes(strokes) });
      savedId = result.id;
      savedCount = strokes.length;
      history.replaceState(null, '', `/?practice&piece=${result.id}`);
      status = 'Saved to your practice pieces.';
    } catch (cause) {
      status = cause instanceof Error ? cause.message : 'That piece could not be saved. Try downloading it instead.';
    } finally {
      saving = false;
    }
  }

  function download() {
    table.finishStroke();
    const link = document.createElement('a');
    link.href = table.snapshot();
    link.download = `${(title.trim() || 'practice-piece').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    link.click();
    status = `Downloaded a full-size PNG (${canvasSize.width} × ${canvasSize.height}).`;
  }

  /** A fresh canvas (and shape). Asks first if there are unsaved marks. */
  async function fresh(next: CanvasShape = shape) {
    confirmNew = false;
    shape = next;
    savedId = null;
    title = 'Practice piece';
    await tick();
    await table.loadHistory('c1', CANVAS_SHAPES[next].width, CANVAS_SHAPES[next].height, [], true, null);
    savedCount = 0;
    history.replaceState(null, '', '/?practice');
    status = `A fresh ${CANVAS_SHAPES[next].name.toLowerCase()} canvas.`;
  }
  function changeShape(next: CanvasShape) {
    if (table.strokes().length && table.strokes().length !== savedCount) {
      status = 'Changing the shape starts a new canvas. Save or download first, or choose “Start fresh”.';
      pendingShape = next;
      confirmNew = true;
      return;
    }
    void fresh(next);
  }
  let pendingShape = $state<CanvasShape>('classic');
  function newCanvas() {
    pendingShape = shape;
    if (table.strokes().length !== savedCount) {
      confirmNew = true;
      status = 'Start a new canvas? Unsaved marks will be lost. Save or download first.';
    } else void fresh();
  }
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
>
  {#snippet partyBar()}
    <div class="practice-bar">
      <p class="tape">Practice table</p>
      <label class="inline">Title <input maxlength="80" bind:value={title} /></label>
      <label class="inline">Canvas
        <select value={shape} onchange={(e) => changeShape(e.currentTarget.value as CanvasShape)}>
          {#each Object.entries(CANVAS_SHAPES) as [id, s] (id)}<option value={id}>{s.name}</option>{/each}
        </select>
      </label>
      {#if confirmNew}
        <button type="button" class="primary" onclick={() => fresh(pendingShape)}>Start fresh</button>
        <button type="button" onclick={() => { confirmNew = false; status = ''; }}>Keep painting</button>
      {/if}
      {#if signedIn}
        <button type="button" class="primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : savedId ? 'Save' : 'Save to my pieces'}</button>
      {/if}
      <button type="button" onclick={download}>Download PNG</button>
      <p class="note" role="status">{status || (signedIn ? 'Just you and the paints. Nothing here is shared.' : 'Just you and the paints. Sign in to save pieces; you can always download.')}</p>
    </div>
  {/snippet}
  {#snippet menu()}
    <button type="button" onclick={newCanvas}>New canvas</button>
    {#if signedIn}<a href="/account/practice">My practice pieces</a>{/if}
    <a href="/account">My studio</a>
  {/snippet}
</PaintingTable>

<style lang="scss">
  @use '../../styles/tokens' as *;
  @use '../../styles/mixins' as *;

  .practice-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;

    > button:not(.primary) {
      min-height: $tap-min;
      padding: 0 0.875rem;
      border: 1px solid #9d8c67;
      border-radius: 4px;
      background: #1c150fe8;
      color: $cream;
    }
  }
  .tape { @include tape-label; margin: 0; font-size: 1.25rem; }
  .note { margin: 0; font-size: 0.875rem; color: $cream-muted; }
  .inline { display: inline-flex; align-items: center; gap: 0.5rem; color: $cream; font-size: 0.875rem; }
  .inline input,
  .inline select { min-height: $tap-min; padding: 0 0.5rem; border-radius: 4px; border: 1px solid #9d8c67; background: #1c150fe8; color: $cream; }
  .inline input { width: 12rem; }
  .primary { min-height: $tap-min; padding: 0 1.125rem; border: 0; border-radius: $radius-pill; background: $cream; color: $walnut-900; font-weight: 700; }
  .primary:disabled { opacity: 0.6; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid $focus; outline-offset: 2px; }
</style>
