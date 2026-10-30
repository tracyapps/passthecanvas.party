<script lang="ts">
  import { onMount } from 'svelte';
  let { compact = false }: { compact?: boolean } = $props();
  const galleryId = $props.id();
  interface Mark { path: string; color: string; width: number; }
  const examples: { title: string; note: string; background: string; marks: Mark[] }[] = [
    { title: 'Somewhere, probably', note: 'A hill became a sunset. Nobody objected.', background: '#f7efd7', marks: [
      { path: 'M0 95 Q80 50 160 95 T320 85 T450 80', color: '#d9b3bf', width: 110 },
      { path: 'M260 100 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0', color: '#f1b635', width: 35 },
      { path: 'M-10 230 Q80 120 180 225 T430 185', color: '#617e76', width: 115 },
      { path: 'M-30 305 Q80 170 180 280 T460 250', color: '#254b5a', width: 110 },
      { path: 'M0 325 Q160 250 430 310', color: '#c16e4d', width: 65 },
      { path: 'M65 230 Q85 170 70 125 M70 170 L45 145 M70 155 L95 135', color: '#253c39', width: 8 },
      { path: 'M170 80 Q185 65 198 80 Q210 65 225 80', color: '#46444e', width: 3 },
    ] },
    { title: 'A very unofficial garden', note: 'Flowers? Fireworks? Yes.', background: '#f7f1e6', marks: [
      ...[85, 170, 270, 340].map((x, index) => ({ path: `M${x} 315 Q${x - 35} 220 ${x} ${110 + index % 2 * 55}`, color: '#548270', width: 8 })),
      ...[85, 170, 270, 340].map((x, index) => { const y = 110 + index % 2 * 55; return { path: `M${x} ${y} C${x - 100} ${y - 60} ${x + 60} ${y - 100} ${x} ${y} C${x + 100} ${y - 55} ${x + 80} ${y + 65} ${x} ${y} C${x - 80} ${y + 90} ${x - 100} ${y - 20} ${x} ${y}`, color: ['#bd4273','#ed9c35','#654f97','#dc684e'][index], width: 16 }; }),
      { path: 'M78 110 h14 M163 165 h14 M263 110 h14 M333 165 h14', color: '#e8b832', width: 14 },
      { path: 'M70 240 Q20 185 70 220 M175 270 Q220 205 175 240 M270 230 Q220 180 270 205', color: '#3b6654', width: 10 },
    ] },
    { title: 'We went with it', note: 'An excellent use of absolutely no plan.', background: '#f8e9d2', marks: [
      { path: 'M50 100 Q175 10 330 100 T350 230', color: '#e4a232', width: 65 },
      { path: 'M100 270 Q20 150 200 180 T350 140', color: '#11787c', width: 55 },
      { path: 'M80 220 C160 35 280 320 335 80', color: '#bc426a', width: 40 },
      { path: 'M50 280 L110 50 L260 260 L360 60', color: '#373e77', width: 12 },
      { path: 'M100 200 Q210 75 310 190 Q220 300 100 200', color: '#f1c94f', width: 19 },
      { path: 'M65 65 l12 10 M320 285 l12 -10 M360 205 l-12 -10 M200 70 l15 0', color: '#4c3f38', width: 6 },
    ] },
  ];
  let progress = $state([100, 100, 100]);
  let playing = $state<number | null>(null);
  let announcement = $state('Illustrative examples. These are not paintings from real parties.');
  function toggle(index: number) {
    if (playing === index) { playing = null; return; }
    if (progress[index] >= 100) progress[index] = 0;
    playing = index;
    announcement = `Playing the example creation of ${examples[index].title}.`;
  }
  function restart(index: number) {
    progress[index] = 0;
    playing = index;
    announcement = `Restarted ${examples[index].title}.`;
  }
  function visibility() { if (document.hidden) playing = null; }
  onMount(() => {
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  });
  // Nothing animates until someone asks to watch a creation.
  $effect(() => {
    const index = playing;
    if (index === null) return;
    const activeIndex = index;
    let frame = 0;
    let last = performance.now();
    function animate(now: number) {
      const elapsed = Math.min(100, now - last);
      last = now;
      progress[activeIndex] = Math.min(100, progress[activeIndex] + elapsed / 90);
      if (progress[activeIndex] >= 100) {
        playing = null;
        announcement = `${examples[activeIndex].title}: example complete.`;
        return;
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  });
</script>

<section class="gallery-wall" class:compact aria-label="The example gallery">
  <div class="wall-label"><span>THE WALL OF</span><strong>“look what we made.”</strong><p>A few imagined possibilities. Your party brings the real thing.</p></div>
  <div class="hung-art">
    {#each examples as example, index}
      <figure class={`painting painting-${index + 1}`}>
        <div class="hanging-wire" aria-hidden="true"></div>
        <div class="frame">
          <svg viewBox="0 0 420 340" role="img" aria-label={`${example.title}, illustrative sample painting`} style:background={example.background}>
            <defs><filter id={`paper-grain-${galleryId}-${index}`}><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncA type="linear" slope=".12" /></feComponentTransfer></filter></defs>
            {#each example.marks as mark, markIndex}
              {@const reveal = Math.max(0, Math.min(1, progress[index] / 100 * example.marks.length - markIndex))}
              <path d={mark.path} stroke={mark.color} stroke-width={mark.width} fill="none" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - reveal} opacity={reveal > 0 ? 1 : 0} />
            {/each}
            <rect width="420" height="340" filter={`url(#paper-grain-${galleryId}-${index})`} opacity=".5" />
          </svg>
        </div>
        <figcaption><span class="sample">ILLUSTRATIVE EXAMPLE</span><h3>{example.title}</h3><p>{example.note}</p>
          <div class="playback"><button onclick={() => toggle(index)} aria-label={`${playing === index ? 'Pause' : 'Play'} ${example.title}`}><svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">{#if playing === index}<path d="M8 5v14M16 5v14" />{:else}<path d="m8 4 12 8-12 8Z" />{/if}</svg>{playing === index ? 'Pause' : 'Play creation'}</button><button onclick={() => restart(index)} aria-label={`Restart ${example.title}`}>Restart</button></div>
          <label class="scrub">Creation progress <input type="range" min="0" max="100" step="1" aria-label={`${example.title} creation progress`} bind:value={progress[index]} oninput={() => { playing = null; }} /><output>{Math.round(progress[index])}%</output></label>
        </figcaption>
      </figure>
    {/each}
  </div>
  <p class="gallery-footnote">A preview of the idea: the finished piece on the wall, with its making just a play button away. These sample animations are illustrated demonstrations; saved party replays and public sharing are still on the roadmap.</p>
  <p class="sr-only" aria-live="polite">{announcement}</p>
</section>

<style lang="scss">
  .gallery-wall { position: relative; isolation: isolate; padding: clamp(28px,5vw,70px) clamp(18px,4vw,60px); background: var(--gallery-wall, #e9deca); color: var(--gallery-ink, #30281f); box-shadow: inset 0 8px 22px #41352716; }
  .gallery-wall::before { content: ''; position: absolute; z-index: -1; inset: 0; opacity: .22; background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23978973' filter='url(%23n)' d='M0 0h200v200H0z'/%3E%3C/svg%3E"); }
  .wall-label { max-width: 550px; margin: 0 auto 65px; text-align: center; } .wall-label span { font-size: .8rem; letter-spacing: .2em; font-weight: 700; } .wall-label strong { display: block; font: 500 clamp(2.4rem,5vw,4rem)/1.1 'Square Peg',cursive; } .wall-label p { font-size: 1rem; line-height: 1.6; }
  .hung-art { display: flex; align-items: start; gap: clamp(24px,4vw,65px); }
  .painting { flex: 1; min-width: 0; margin: 0; position: relative; }
  .painting-1 { transform: rotate(-2deg); margin-top: 25px; } .painting-2 { margin-top: 95px; transform: rotate(2deg); } .painting-3 { transform: rotate(-1deg); }
  .hanging-wire { position: absolute; top: -40px; width: 50%; height: 70px; left: 25%; border-top: 1px solid #4b4237; transform: rotate(-20deg) skew(45deg); z-index: -1; }
  .frame { padding: clamp(10px,1.5vw,20px); border: 2px solid #644326; background: #714b2e url('/site/walnut.webp') center/700px; box-shadow: inset 2px 2px 2px #b99065, inset -3px -3px 2px #281a10, 5px 12px 12px #3929164d; }
  .frame > svg { display: block; width: 100%; height: auto; box-shadow: 0 0 0 2px #251d18, inset 2px 2px 5px #0005; }
  figcaption { padding: 18px 16px; margin: 22px auto 0; width: 95%; background: #fbf5e7; color: #30281f; box-shadow: 1px 3px 5px #48331e24; transform: rotate(1deg); }
  .sample { font-size: .65rem; font-weight: 700; letter-spacing: .1em; color: #61513d; } h3 { font: 600 1.55rem/1.15 'Square Peg',cursive; margin: 7px 0; } figcaption p { font-size: .88rem; line-height: 1.5; margin: 0 0 12px; }
  .playback { display: flex; gap: 6px; flex-wrap: wrap; } button { min-height: 44px; min-width: 44px; padding: 8px 10px; border: 1px solid #887251; background: #f0e4cb; color: #30281f; border-radius: 3px; font: inherit; font-size: .85rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
  .scrub { display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; font-size: .8rem; margin-top: 12px; } input { width: 100%; min-height: 44px; accent-color: #765132; } output { font-variant-numeric: tabular-nums; }
  :is(button,input):focus-visible { outline: 3px solid #794007; outline-offset: 3px; }
  .gallery-footnote { margin: 65px auto 0; max-width: 700px; font-size: .9rem; line-height: 1.7; text-align: center; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .compact .gallery-footnote { margin-top: 35px; }
  @media(max-width: 800px) { .hung-art { flex-direction: column; align-items: center; gap: 65px; } .painting { width: min(100%,440px); margin: 0; } .wall-label { margin-bottom: 75px; } .gallery-footnote { margin-top: 35px; } }
  @media(prefers-reduced-motion: reduce) { .painting { transform: none; } }
</style>
