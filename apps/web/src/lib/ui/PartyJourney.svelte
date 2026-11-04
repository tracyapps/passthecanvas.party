<!--
  One canvas, five painters: an example of a canvas going around the circle,
  from a careful sunset to a dragon in a hat. Every level is welcome.
  - "strip": all five rounds in a row (wraps on small screens).
  - "stepper": one round at a time, with round buttons and next/back.
-->
<script lang="ts">
  let { mode = 'strip' }: { mode?: 'strip' | 'stepper' } = $props();
  const rounds = [
    { caption: 'A very nice sunset.', note: 'Careful. Calm. Extremely hinged.', alt: 'Round 1: a soft painted sunset, purple sky and pink clouds over a band of orange and a dark green field.' },
    { caption: 'Someone added a tree.', note: 'Moody. Tasteful. Still hinged.', alt: 'Round 2: the same sunset with a dark scribbly pine tree on the right.' },
    { caption: 'A little blue bird moved in.', note: 'Adorable. Getting ideas.', alt: 'Round 3: a small teal bird now perches on the tree.' },
    { caption: 'Then: a dragon. Obviously.', note: 'Lime green. Orange wings. Many teeth.', alt: 'Round 4: a scribbly lime green creature with big orange wings, googly eyes and a toothy grin stands in front of the sunset.' },
    { caption: 'And a hat. For the dragon.', note: 'Fully unhinged. Perfect.', alt: 'Round 5: the dragon now wears a tall orange top hat.' }
  ];
  let step = $state(0);
  const id = $props.id();
</script>

{#if mode === 'strip'}
  <ol class="journey" aria-label="One canvas passed around five painters">
    {#each rounds as round, index (index)}
      <li>
        <figure class="paper journey-card" style:--tilt={`${[-1.6, 1.1, -0.6, 1.4, -1][index]}deg`}>
          <span class="handwritten round">round {index + 1}</span>
          <img src={`/site/journey-${index + 1}-small.webp`} srcset={`/site/journey-${index + 1}-small.webp 480w, /site/journey-${index + 1}.webp 900w`} sizes="(max-width: 760px) 44vw, 220px" width="480" height="480" alt={round.alt} loading="lazy" decoding="async" />
          <figcaption><strong>{round.caption}</strong> <small>{round.note}</small></figcaption>
        </figure>
        {#if index < rounds.length - 1}<span class="pass" aria-hidden="true" title="pass it on">↷</span>{/if}
      </li>
    {/each}
  </ol>
{:else}
  <figure class="stepper paper" aria-labelledby={`${id}-title`}>
    <div class="frame"><img src={`/site/journey-${step + 1}.webp`} width="900" height="900" alt={rounds[step]!.alt} /></div>
    <figcaption>
      <h3 id={`${id}-title`}>From hinged to unhinged</h3>
      <p class="handwritten" aria-live="polite">Round {step + 1}: {rounds[step]!.caption}</p>
      <p>{rounds[step]!.note}</p>
      <div class="controls" role="group" aria-label="Choose a round">
        <button type="button" disabled={step === 0} onclick={() => (step -= 1)} aria-label="Previous round">←</button>
        {#each rounds as _, index (index)}<button type="button" aria-pressed={step === index} aria-label={`Round ${index + 1}`} onclick={() => (step = index)}>{index + 1}</button>{/each}
        <button type="button" disabled={step === rounds.length - 1} onclick={() => (step += 1)} aria-label="Next round">→</button>
      </div>
      <p class="hint">Five people, one canvas. Everyone painted on top of everyone else.</p>
    </figcaption>
  </figure>
{/if}

<style>
  .journey { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; gap: 4px; }
  .journey li { display: flex; align-items: center; gap: 4px; flex: 1 1 0; min-width: 0; }
  .journey-card { position: relative; color: #2a261e; margin: 0; padding: 10px 10px 12px; flex: 1 1 0; min-width: 0; transform: rotate(var(--tilt)); box-shadow: 0 8px 18px #0003; }
  .journey-card img { display: block; width: 100%; height: auto; aspect-ratio: 1; }
  /* A little paper tab, so the label reads on dark wood and light walls alike. */
  .round { position: absolute; top: -16px; left: 8px; padding: 0 8px; font-size: 19px; line-height: 1.3; color: #2a261e; background: #f5ecdc; box-shadow: 0 2px 4px #0003; }
  figcaption { margin-top: 8px; font-size: 13px; line-height: 1.35; }
  figcaption small { display: block; opacity: .8; }
  .pass { flex: none; font-size: 28px; line-height: 1; opacity: .85; }
  @media (max-width: 900px) {
    .journey { flex-wrap: wrap; justify-content: center; gap: 22px 14px; }
    .journey li { flex: 0 1 calc(50% - 14px); }
    .pass { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .journey-card { transform: none; } }

  .stepper { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(14rem, 1fr); gap: 24px 32px; align-items: center; margin: 0; padding: 18px; }
  @media (max-width: 760px) { .stepper { grid-template-columns: minmax(0, 1fr); } }
  .frame { padding: 10px; background: #6b4426; box-shadow: 0 10px 24px #0004; }
  .frame img { display: block; width: 100%; height: auto; aspect-ratio: 1; }
  .stepper h3 { margin: 0 0 8px; font-size: 28px; }
  .stepper .handwritten { font-size: 24px; margin: 0 0 4px; }
  .controls { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
  .controls button { min-width: 44px; min-height: 44px; font: inherit; font-weight: 700; border: 2px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
  .controls button[aria-pressed='true'] { background: #2a261e; color: #fff6e5; border-color: #2a261e; }
  .controls button:disabled { opacity: .4; cursor: default; }
  .hint { font-size: 14px; opacity: .8; }
</style>
