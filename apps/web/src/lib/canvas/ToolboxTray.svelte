<script lang="ts">
  import { tick } from 'svelte';
  import type { ColorPalette } from '@ptc/shared';
  import PhotoSupply from './PhotoSupply.svelte';
  import PaletteDisc from './PaletteDisc.svelte';
  import { MAX_TRAY_ROWS, PALETTES_PER_TRAY, TOOLS_PER_ROW } from './toolboxes';
  type Supply = { id: string; name: string; image: string };
  let { rows, paletteIds, supplies, palettes, selected, chooseTool, choosePalette, onchange, onnew }: {
    rows: string[][]; paletteIds: string[]; supplies: Supply[]; palettes: ColorPalette[];
    selected: (id: string) => boolean; chooseTool: (id: string) => void;
    choosePalette: (id: string) => void;
    onchange: (rows: string[][], paletteIds: string[]) => void;
    onnew: () => void;
  } = $props();
  let editing = $state(false);
  type TrayPicker = { kind: 'tool'; row: number; slot: number } | { kind: 'palette'; slot: number };
  let picker = $state<TrayPicker | null>(null);
  let pickerPanel = $state<HTMLElement>();
  async function openPicker(next: TrayPicker) {
    picker = next;
    await tick();
    pickerPanel?.focus();
  }
  let availableTools = $derived(supplies.filter(supply => !rows.flat().includes(supply.id) ||
    (picker?.kind === 'tool' && rows[picker.row]?.[picker.slot] === supply.id)));
  let availablePalettes = $derived(palettes.filter(palette => !palette.hidden && (!paletteIds.includes(palette.id) ||
    (picker?.kind === 'palette' && paletteIds[picker.slot] === palette.id))));

  function setTool(id: string) {
    if (picker?.kind !== 'tool') return;
    const next = rows.map(row => [...row]);
    if (!next[picker.row]) return;
    next[picker.row][picker.slot] = id;
    onchange(next, [...paletteIds]);
    picker = null;
  }
  function removeTool(row: number, slot: number) {
    const next = rows.map(row => [...row]);
    next[row].splice(slot, 1);
    onchange(next, [...paletteIds]);
    picker = null;
  }
  function setPalette(id: string) {
    if (picker?.kind !== 'palette') return;
    const next = [...paletteIds];
    next[picker.slot] = id;
    onchange(rows.map(row => [...row]), next);
    picker = null;
  }
</script>

<div class="tray">
  <div class="tray-actions">
    <button type="button" aria-pressed={editing} onclick={() => { editing = !editing; picker = null; }}>{editing ? 'Done editing' : 'Edit tray'}</button>
    <button type="button" onclick={() => { picker = null; onnew(); editing = true; }}>New empty tray</button>
  </div>
  <div class="tool-rows">
    {#each rows as row, rowIndex}
      <div class="row-group">
        <div class="tool-row" aria-label={`Tool row ${rowIndex + 1}`} role="group">
          {#each row as id, slot}
            {@const supply = supplies.find(supply => supply.id === id)}
            {#if supply}
              <div class="slot">
                <div class="tool"><PhotoSupply image={supply.image} label={supply.name} compact selected={selected(id)} onclick={() => chooseTool(id)} /></div>
                {#if editing}
                  <div class="slot-actions">
                    <button type="button" aria-label={`Replace ${supply.name}`} onclick={() => openPicker({ kind: 'tool', row: rowIndex, slot })}>Replace</button>
                    <button type="button" aria-label={`Remove ${supply.name}`} onclick={() => removeTool(rowIndex, slot)}>Remove</button>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
          {#if row.length < TOOLS_PER_ROW && rows.flat().length < supplies.length}
            <button class="add" type="button" aria-label={`Add tool to row ${rowIndex + 1}`} onclick={() => openPicker({ kind: 'tool', row: rowIndex, slot: row.length })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
            </button>
          {/if}
        </div>
        {#if editing}<button class="remove-row" type="button" aria-label={`Remove tool row ${rowIndex + 1}`} onclick={() => { onchange(rows.filter((_, index) => index !== rowIndex), [...paletteIds]); picker = null; }}>Remove row</button>{/if}
      </div>
    {/each}
  </div>
  <button class="add-row" type="button" disabled={rows.length >= MAX_TRAY_ROWS} onclick={() => { onchange([...rows.map(row => [...row]), []], [...paletteIds]); picker = null; }}>Add row</button>
  <section class="palette-shelf" aria-label="Palette shortcuts">
    <div class="discs">
      {#each paletteIds as id, slot}
        {@const palette = palettes.find(palette => palette.id === id)}
        <div class="palette-slot">
          <button type="button" class="palette-button" disabled={!palette} aria-label={palette ? `Open ${palette.name} palette` : 'Palette unavailable'} onclick={() => choosePalette(id)}>
            {#if palette}<PaletteDisc colors={palette.colors} />{:else}<span class="missing">Unavailable</span>{/if}
          </button>
          <span class="palette-name">{palette?.name ?? 'Choose a replacement'}</span>
          {#if editing}<div class="slot-actions">
            <button type="button" aria-label={`Replace palette ${palette?.name ?? slot + 1}`} onclick={() => openPicker({ kind: 'palette', slot })}>Replace</button>
            <button type="button" aria-label={`Remove palette ${palette?.name ?? slot + 1}`} onclick={() => { onchange(rows.map(row => [...row]), paletteIds.filter((_, index) => index !== slot)); picker = null; }}>Remove</button>
          </div>{/if}
        </div>
      {/each}
      {#if paletteIds.length < PALETTES_PER_TRAY}
        <button class="add" type="button" aria-label="Add palette shortcut" onclick={() => openPicker({ kind: 'palette', slot: paletteIds.length })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
        </button>
      {/if}
    </div>
  </section>
  {#if picker}
    <section bind:this={pickerPanel} tabindex="-1" class="picker" aria-label={picker.kind === 'tool' ? 'Choose a tray tool' : 'Choose a tray palette'}>
      <div class="picker-head"><h3>{picker.kind === 'tool' ? 'Choose a tool' : 'Choose a palette'}</h3><button type="button" onclick={() => picker = null}>Cancel</button></div>
      <div class="choices">
        {#if picker.kind === 'tool'}
          {#each availableTools as supply}<button type="button" class="choice" onclick={() => setTool(supply.id)}><img src={supply.image} alt="" /><span>{supply.name}</span></button>{/each}
        {:else}
          {#each availablePalettes as palette}<button type="button" class="choice" onclick={() => setPalette(palette.id)}><PaletteDisc colors={palette.colors} /><span>{palette.name}</span></button>{/each}
          {#if !availablePalettes.length}<p>No more visible palettes. Manage your palette library in account settings.</p>{/if}
        {/if}
      </div>
    </section>
  {/if}
</div>

<style lang="scss">
  .tray { padding: 8px; border-radius: 6px 6px 12px 12px; border: 2px solid #756d59; background: linear-gradient(120deg, #43483d, #282d29); box-shadow: inset 0 2px 2px #c3bca744, 0 5px 8px #0006; }
  button { min-height: 44px; font: inherit; color: #f7eddb; background: #20241e; border: 1px solid #a49b7f; border-radius: 4px; padding: 5px 7px; cursor: pointer; }
  button:focus-visible { outline: 3px solid #f1e953; outline-offset: 2px; }
  button:disabled { opacity: .5; cursor: default; }
  .tray-actions, .picker-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 12px; }
  .tool-rows { display: flex; flex-direction: column; gap: 8px; }
  .row-group { padding: 5px; background: #151b17; border: 1px solid #707463; border-radius: 7px; box-shadow: inset 0 3px 6px #0009, 0 1px #ada99044; }
  .tool-row { display: flex; gap: 5px; align-items: stretch; }
  .slot { flex: 1 1 0; min-width: 0; }
  .tool { height: 122px; }
  .slot-actions { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
  .slot-actions button { flex: 1 1 44px; min-width: 0; font-size: 10px; padding: 3px; }
  .add { flex: 0 0 44px; width: 44px; align-self: center; display: grid; place-items: center; border-style: dashed; }
  .add svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.5; }
  .add-row { display: block; margin: 8px auto; font-size: 12px; }
  .remove-row { margin-top: 4px; font-size: 11px; background: transparent; }
  .palette-shelf { padding: 8px 4px; border-top: 3px ridge #757965; }
  .discs { display: flex; align-items: start; gap: 0; }
  .palette-slot { flex: 0 1 108px; max-width: 108px; min-width: 0; }
  .palette-slot + .palette-slot { margin-left: -5px; }
  .palette-button { display: block; width: 100%; padding: 3px; border: 0; background: transparent; border-radius: 50%; }
  .palette-button:hover, .palette-button:focus-visible { position: relative; z-index: 1; }
  .palette-name { display: block; font-size: 11px; text-align: center; overflow-wrap: anywhere; padding: 3px 5px; }
  .picker { margin-top: 8px; padding: 8px; background: #151b17; border: 1px solid #b2a27d; border-radius: 4px; }
  h3 { font-size: 14px; margin: 0; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 6px; }
  .choice { display: flex; flex-direction: column; gap: 5px; align-items: center; min-width: 0; font-size: 11px; }
  .choice img { width: 100%; height: 70px; object-fit: contain; }
  .choice :global(.disc) { max-width: 72px; }
  .missing { display: grid; place-items: center; aspect-ratio: 1; border: 2px dashed #d2b98e; border-radius: 50%; font-size: 11px; }
</style>
