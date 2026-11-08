<script lang="ts">
  import { workspaceGeometry, designPoint, canvasTop, viewTransform } from './workspace-geometry';
  import { SUPPLIES, supplyAsset, supplyImage } from './supplies';
  import type { WorkspaceLayout, WorkspaceSurface } from './workspaces';
  let {
    layout,
    viewport,
    editable = false,
    selected = 'canvas',
    onselect,
    onchange,
  }: {
    layout: WorkspaceLayout;
    viewport: WorkspaceSurface;
    editable?: boolean;
    selected?: string;
    onselect?: (id: string) => void;
    onchange?: (layout: WorkspaceLayout) => void;
  } = $props();
  let stage: HTMLDivElement;
  let geometry = $derived(workspaceGeometry(layout, viewport));
  let renderHeight = $derived(
    geometry.compact
      ? Math.max(
          viewport.height,
          geometry.frame.y + geometry.frame.height + 50,
          ...Object.values(geometry.boxes).map((box) => box.y + box.height + 16)
        )
      : viewport.height
  );
  let source = $derived(layout.surface ?? viewport);
  let drag: {
    id: string;
    x: number;
    y: number;
    rect: { x: number; y: number; width: number; height: number };
    pointer: number;
  } | null = null;
  function move(id: string, dx: number, dy: number) {
    const rect = id === 'canvas' || id === 'resize' ? geometry.frame : geometry.boxes[id];
    if (!rect) return;
    const point = geometry.compact
      ? { x: rect.x + dx, y: rect.y + dy }
      : designPoint(rect.x + dx, rect.y + dy, source, viewport);
    if (id === 'canvas') {
      onchange?.({
        ...layout,
        frame: {
          x: Math.max(0, point.x / source.width),
          y: Math.max(canvasTop(source) / source.height, point.y / source.height),
          width: layout.frame?.width ?? rect.width / source.width,
          height: layout.frame?.height ?? rect.height / source.height,
        },
      });
    } else {
      onchange?.({
        ...layout,
        positions: {
          ...layout.positions,
          [id]: {
            x: Math.max(0, Math.min(0.98, point.x / source.width)),
            y: Math.max(
              source.headerHeight / source.height,
              Math.min(0.98, point.y / source.height)
            ),
          },
        },
      });
    }
  }
  function down(event: PointerEvent, id: string) {
    if (
      !editable ||
      (geometry.compact && (id === 'canvas' || id === 'resize')) ||
      event.button !== 0
    )
      return;
    // Capturing a drag prevents the browser's usual click focus; keep arrow keys usable.
    // Focus first so a numeric field commits before the selected item changes.
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    onselect?.(id === 'resize' ? 'canvas' : id);
    const rect = id === 'canvas' || id === 'resize' ? geometry.frame : geometry.boxes[id];
    drag = { id, x: event.clientX, y: event.clientY, rect: { ...rect }, pointer: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function pointerMove(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (
      drag.id !== 'canvas' &&
      drag.id !== 'resize' &&
      (geometry.compact || layout.dock !== 'surround')
    )
      return;
    const factor = viewport.width / stage.getBoundingClientRect().width;
    const current =
      drag.id === 'canvas' || drag.id === 'resize' ? geometry.frame : geometry.boxes[drag.id];
    if (drag.id === 'resize') {
      const fitScale = viewTransform(source, viewport).scale;
      const width = Math.max(260, drag.rect.width + (event.clientX - drag.x) * factor);
      const height = Math.max(200, drag.rect.height + (event.clientY - drag.y) * factor);
      onchange?.({
        ...layout,
        frame: {
          ...layout.frame!,
          width: Math.min(1, width / fitScale / source.width),
          height: Math.min(1, height / fitScale / source.height),
        },
      });
    } else
      move(
        drag.id,
        drag.rect.x + (event.clientX - drag.x) * factor - current.x,
        drag.rect.y + (event.clientY - drag.y) * factor - current.y
      );
  }
  function up(event: PointerEvent) {
    if (
      drag &&
      drag.id !== 'canvas' &&
      drag.id !== 'resize' &&
      (geometry.compact || layout.dock !== 'surround') &&
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4
    ) {
      const bounds = stage.getBoundingClientRect(),
        factor = viewport.width / bounds.width;
      const x = (event.clientX - bounds.left) * factor,
        y = (event.clientY - bounds.top) * factor;
      const closest = Object.entries(geometry.boxes).sort(
        (a, b) =>
          Math.hypot(a[1].x + a[1].width / 2 - x, a[1].y + a[1].height / 2 - y) -
          Math.hypot(b[1].x + b[1].width / 2 - x, b[1].y + b[1].height / 2 - y)
      )[0]?.[0];
      if (closest && closest !== drag.id) {
        const targetIndex = layout.order.indexOf(closest);
        const order = layout.order.filter((id) => id !== drag!.id);
        order.splice(targetIndex, 0, drag.id);
        onchange?.({ ...layout, order });
      }
    }
    drag = null;
  }
  function keyboard(event: KeyboardEvent, id: string) {
    const steps: Record<string, number[]> = {
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0],
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
    };
    if (!editable || !steps[event.key]) return;
    if (geometry.compact || layout.dock !== 'surround') {
      if (id === 'canvas') return;
      event.preventDefault();
      const shown = layout.order.filter(id => layout.supplies?.includes(id) ?? true);
      const index = shown.indexOf(id);
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const next = index + direction;
      if (index < 0 || next < 0 || next >= shown.length) return;
      [shown[index], shown[next]] = [shown[next], shown[index]];
      onchange?.({ ...layout, order: [...shown, ...layout.order.filter(id => !shown.includes(id))] });
      return;
    }
    event.preventDefault();
    move(id, steps[event.key][0], steps[event.key][1]);
  }
</script>

<div class="viewport" style:aspect-ratio={`${viewport.width}/${viewport.height}`}>
  <div
    bind:this={stage}
    class="preview"
    class:editable
    style:aspect-ratio={`${viewport.width}/${renderHeight}`}
    style:background-image={`linear-gradient(#1e0f0599, #1e0f0599), url("${supplyAsset('wood', 'webp')}")`}
  >
    <div class="top" style:height={`${(viewport.headerHeight / renderHeight) * 100}%`}></div>
    {#each [{ id: 'canvas', rect: geometry.frame }, ...Object.entries(geometry.boxes).map( ([id, rect]) => ({ id, rect }) )] as item (item.id)}
      <button
        type="button"
        class="piece"
        class:paper={item.id === 'canvas'}
        class:tile={item.id !== 'canvas' &&
          (layout.toolView === 'grid' || geometry.compact || layout.dock !== 'surround')}
        class:selected={editable && selected === item.id}
        disabled={!editable}
        aria-label={item.id === 'canvas'
          ? 'Position canvas frame'
          : `Position ${SUPPLIES.find((supply) => supply.id === item.id)?.name}`}
        style:left={`${(item.rect.x / viewport.width) * 100}%`}
        style:top={`${(item.rect.y / renderHeight) * 100}%`}
        style:width={`${(item.rect.width / viewport.width) * 100}%`}
        style:height={`${(item.rect.height / renderHeight) * 100}%`}
        style:--label-size={`calc(1200cqw / ${viewport.width})`}
        style:--label-padding={`calc(400cqw / ${viewport.width}) calc(300cqw / ${viewport.width})`}
        onpointerdown={(event) => down(event, item.id)}
        onpointermove={pointerMove}
        onpointerup={up}
        onpointercancel={() => (drag = null)}
        onclick={() => onselect?.(item.id)}
        onkeydown={(event) => keyboard(event, item.id)}
      >
        {#if item.id !== 'canvas'}<img
            src={supplyImage(
              item.id,
              geometry.compact || layout.dock !== 'surround'
                ? 'grid'
                : (layout.toolView ?? 'cutouts')
            )}
            alt=""
            draggable="false"
          />{#if layout.toolView === 'grid' || geometry.compact || layout.dock !== 'surround'}<span
              class="tile-name">{SUPPLIES.find((supply) => supply.id === item.id)?.name}</span
            >{/if}{/if}
      </button>
    {/each}
    {#if editable && !geometry.compact}
      <button
        type="button"
        class="resize"
        aria-label="Resize preview canvas frame"
        style:left={`${((geometry.frame.x + geometry.frame.width) / viewport.width) * 100}%`}
        style:top={`${((geometry.frame.y + geometry.frame.height) / renderHeight) * 100}%`}
        onpointerdown={(event) => down(event, 'resize')}
        onpointermove={pointerMove}
        onpointerup={up}
        onpointercancel={() => (drag = null)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2 14 12-12M8 14l6-6" /></svg>
      </button>
    {/if}
  </div>
</div>

<style>
  .viewport {
    width: 100%;
    overflow: auto;
    border: 1px solid #9a835f;
    border-radius: 4px;
  }
  .preview {
    container-type: inline-size;
    position: relative;
    width: 100%;
    overflow: hidden;
    background-size: cover;
    isolation: isolate;
  }
  .top {
    position: absolute;
    inset: 0 0 auto;
    background: #160f09e8;
  }
  .piece {
    position: absolute;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: grab;
    touch-action: none;
    border-radius: 0;
  }
  .piece:disabled {
    opacity: 1;
    cursor: default;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }
  .piece.tile {
    display: flex;
    flex-direction: column;
    background: #38291d;
  }
  .tile img {
    height: 0;
    min-height: 0;
    flex: 1 1 0;
    object-fit: contain;
  }
  .tile-name {
    display: block;
    flex: none;
    width: 100%;
    font-size: var(--label-size);
    padding: var(--label-padding);
    line-height: 1.25;
    color: #fff5e4;
    background: #1d150ef2;
    overflow-wrap: anywhere;
  }
  .paper {
    background: #f4eee1;
    border: 2px solid #ad9c77;
    box-shadow: 1px 3px 3px #0006;
  }
  .resize {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 4;
    width: 44px;
    height: 44px;
    min-height: 44px;
    padding: 3px;
    background: #32281c;
    border: 1px solid #ffee48;
    color: #fff;
    touch-action: none;
    cursor: nwse-resize;
  }
  .resize svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
  }
  .piece.selected {
    outline: 2px solid #fff23d;
    z-index: 2;
  }
  .piece:focus-visible {
    outline: 3px solid #fff;
    z-index: 3;
  }
</style>
