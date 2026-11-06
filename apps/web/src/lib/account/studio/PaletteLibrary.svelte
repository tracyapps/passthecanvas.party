<script lang="ts">
  import { tick } from 'svelte';
  import { cleanColorPalette, MAX_COLOR_PALETTES, MAX_PALETTE_COLORS, type ColorPalette } from '@ptc/shared';
  import { colorLibrary, importPalette } from '../../canvas/color-library';
  import { fileSlug, saveFile } from '../../download';
  import { prefs, savePreferences } from '../../prefs.svelte';

  let library = $derived(colorLibrary(prefs.colorPalettes));
  let draft = $state<ColorPalette | null>(null);
  let note = $state('');
  let saving = $state(false);
  let nameInput = $state<HTMLInputElement>();

  async function edit(palette: ColorPalette) {
    draft = { ...palette, colors: palette.colors.map((color) => ({ ...color })) };
    note = '';
    await tick();
    nameInput?.focus();
  }

  function create(palette?: ColorPalette) {
    edit({
      id: crypto.randomUUID(),
      name: palette ? `${palette.name.slice(0, 55)} copy` : 'My palette',
      colors: palette?.colors ?? [{ name: 'Color 1', hex: '#704735' }],
      hidden: false,
      favorite: false,
    });
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const palette = cleanColorPalette(draft);
    if (!palette) { note = 'Give the palette and each color a name.'; return; }
    const others = prefs.colorPalettes.filter((item) => item.id !== palette.id);
    if (others.length >= MAX_COLOR_PALETTES) { note = `You can save up to ${MAX_COLOR_PALETTES} custom palettes and preset edits.`; return; }
    saving = true;
    try {
      await savePreferences({ colorPalettes: [...others, palette] });
      draft = null;
      note = `${palette.name} saved.`;
    } catch {
      note = 'Account sync failed. The palette is saved in this browser.';
    } finally { saving = false; }
  }

  async function readFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 48_000) throw new Error();
      const palette = importPalette(await file.text());
      if (!palette) throw new Error();
      await edit(palette);
      note = 'Imported palette ready to review and save.';
    } catch { note = 'Choose a valid Pass the Canvas palette JSON file.'; }
  }

  async function exportPalette({ name, colors }: ColorPalette) {
    const json = JSON.stringify({ format: 'ptc-color-palette', version: 1, name, colors }, null, 2);
    try {
      const result = await saveFile(new Blob([json], { type: 'application/json' }), `${fileSlug(name, 'palette')}.json`, name);
      note = result === 'cancelled' ? 'Sharing cancelled.' : result === 'shared' ? 'Palette shared.' : 'Palette downloaded.';
    } catch { note = 'Could not export this palette.'; }
  }
</script>

<section class="card stack" aria-labelledby="palette-library-title">
  <h2 id="palette-library-title">Color palette library</h2>
  <p class="hint">Browse studio presets and your own palettes. Visible palettes appear in the painting table picker, with favorites first. Share a palette by exporting its JSON file.</p>
  <div class="row">
    <button type="button" class="btn" disabled={saving} onclick={() => create()}>New palette</button>
    <label class="field">Import palette<input type="file" accept=".json,application/json" disabled={saving} onchange={readFile} /></label>
  </div>
  <p role="status" class="hint">{note}</p>
  {#if draft}
    <form class="stack editor" onsubmit={save}>
      <h3>Edit palette</h3>
      <label class="field">Palette name<input bind:this={nameInput} bind:value={draft.name} maxlength="60" required /></label>
      <label class="check"><input type="checkbox" bind:checked={draft.hidden} /> Hide from the painting table picker</label>
      <label class="check"><input type="checkbox" bind:checked={draft.favorite} /> Favorite</label>
      {#each draft.colors as color, index}
        <div class="swatch-edit">
          <label class="field">Color {index + 1} name<input bind:value={color.name} maxlength="48" required /></label>
          <label class="field">Swatch {index + 1}<input type="color" bind:value={color.hex} /></label>
          <button type="button" class="btn quiet" aria-label={`Remove color ${index + 1}`} disabled={draft.colors.length === 1} onclick={() => draft?.colors.splice(index, 1)}>Remove</button>
        </div>
      {/each}
      <div class="row">
        <button type="button" class="btn quiet" disabled={draft.colors.length >= MAX_PALETTE_COLORS} onclick={() => draft?.colors.push({ name: `Color ${draft.colors.length + 1}`, hex: '#704735' })}>Add color</button>
        <button type="submit" class="btn" disabled={saving}>Save palette</button>
        <button type="button" class="btn quiet" disabled={saving} onclick={() => draft = null}>Cancel</button>
      </div>
    </form>
  {/if}
  <ul class="palette-list">
    {#each library as palette (palette.id)}
      <li class="stack">
        <h3>{palette.name}</h3>
        <p class="hint">{palette.hidden ? 'Hidden from picker' : 'In picker'}{palette.favorite ? ' · Favorite' : ''}</p>
        <ul class="swatches" aria-label={`${palette.name} colors`}>
          {#each palette.colors as color}
            <li title={`${color.name} ${color.hex}`}><span style:background={color.hex}></span><span class="sr-only">{color.name} {color.hex}</span></li>
          {/each}
        </ul>
        <div class="row">
          <button type="button" class="btn quiet" aria-label={`Edit ${palette.name}`} disabled={saving} onclick={() => edit(palette)}>Edit</button>
          <button type="button" class="btn quiet" aria-label={`Duplicate ${palette.name}`} disabled={saving} onclick={() => create(palette)}>Duplicate</button>
          <button type="button" class="btn quiet" aria-label={`Export ${palette.name}`} onclick={() => exportPalette(palette)}>Export</button>
        </div>
      </li>
    {/each}
  </ul>
</section>

<style>
  .editor { padding: 1rem; border: 1px solid currentColor; }
  .palette-list, .swatches { padding: 0; margin: 0; list-style: none; display: grid; gap: .75rem; }
  .palette-list { grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
  .palette-list > li { border: 1px solid #9d8c67; border-radius: 4px; padding: .75rem; }
  .swatches { display: flex; flex-wrap: wrap; gap: 3px; }
  .swatches li > span:first-child { display: block; width: 1.5rem; height: 1.75rem; border: 1px solid #514635; }
  .swatch-edit { display: flex; align-items: end; flex-wrap: wrap; gap: .5rem; }
  .swatch-edit input[type='color'] { width: 3rem; }
  button, input { min-height: 44px; }
</style>
