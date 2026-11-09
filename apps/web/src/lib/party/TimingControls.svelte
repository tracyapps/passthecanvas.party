<!--
  The host's timing controls, in the lobby and during the party:
  a set party length (turns share the time) or a set turn length (the party
  runs as long as it takes). Changes go to everyone at once.
-->
<script lang="ts">
  import { durationText, planTiming, TURN_LENGTHS, turnLengthText, type PartyState, type PartyTiming } from '@ptc/shared';
  import type { PartyConnection } from './connection.svelte';

  let { party, game }: { party: PartyConnection; game: PartyState } = $props();
  let t = $derived(game.timing);
  let artists = $derived(game.phase === 'lobby' ? game.order.length : game.order.length);
  let plan = $derived(planTiming(t, artists));
  const send = (change: Partial<PartyTiming>) => party.send({ type: 'setTiming', timing: { ...game.timing, ...change } });
  const turns = [...TURN_LENGTHS, 240, 420, 600].sort((a, b) => a - b);
</script>

<fieldset class="timing">
  <legend>Timing</legend>
  <label class="opt"><input type="radio" name="timing-mode" checked={t.mode === 'party'} onchange={() => send({ mode: 'party' })} /> Set the party length</label>
  <label class="opt"><input type="radio" name="timing-mode" checked={t.mode === 'turn'} onchange={() => send({ mode: 'turn' })} /> Set the turn length</label>
  {#if t.mode === 'party'}
    <label>Party length
      <select value={t.partyMinutes} onchange={(e) => send({ partyMinutes: Number(e.currentTarget.value) })}>
        {#each [30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240] as m (m)}<option value={m}>{durationText(m * 60)}</option>{/each}
      </select>
    </label>
  {:else}
    <label>Each turn
      <select value={t.turnSeconds} onchange={(e) => send({ turnSeconds: Number(e.currentTarget.value) })}>
        {#if !turns.includes(t.turnSeconds)}<option value={t.turnSeconds}>{turnLengthText(t.turnSeconds)}</option>{/if}
        {#each turns as s (s)}<option value={s}>{turnLengthText(s)}</option>{/each}
      </select>
    </label>
  {/if}
  {#if game.phase === 'lobby'}
    <label>Hellos & instructions
      <select value={t.introMinutes} onchange={(e) => send({ introMinutes: Number(e.currentTarget.value) })}>{#each [0, 5, 10, 15, 20] as m (m)}<option value={m}>{m ? `${m} min` : 'None'}</option>{/each}</select>
    </label>
  {/if}
  <!-- Small parties can pass the canvases around more than once. -->
  <label>Times around the circle
    <select value={t.laps ?? 1} onchange={(e) => send({ laps: Number(e.currentTarget.value) })}>{#each [1, 2, 3, 4, 5] as n (n)}<option value={n}>{n === 1 ? 'Once (everyone paints every canvas once)' : `${n} times`}</option>{/each}</select>
  </label>
  <label>Wrap-up & reveal
    <select value={t.wrapMinutes} onchange={(e) => send({ wrapMinutes: Number(e.currentTarget.value) })}>{#each [0, 5, 10, 15, 20, 30] as m (m)}<option value={m}>{m ? `${m} min` : 'None'}</option>{/each}</select>
  </label>
  <p class="hint" aria-live="polite">
    {#if game.phase === 'lobby'}
      {artists} {artists === 1 ? 'artist' : 'artists'}{(t.laps ?? 1) > 1 ? `, ${t.laps} times around` : ''} → {plan.rounds} rounds of {turnLengthText(plan.turnSeconds)}, about {durationText(plan.totalSeconds)} in all.
      {#if plan.tooShort}<strong>Too short for everyone: turns are at the 20-second minimum.</strong>{/if}
    {:else}
      Round {game.round} of {game.totalRounds}. Turns are {turnLengthText(game.turnSeconds)} now{game.plannedEndAt ? `; painting wraps up around ${new Date(game.plannedEndAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}. Changes apply to everyone right away.
    {/if}
  </p>
</fieldset>

<style lang="scss">
  @use '../../styles/tokens' as *;
  .timing { display: grid; gap: 0.5rem; border: 1px solid #b9a483; border-radius: $radius-sm; padding: 0.75rem; margin: 0; }
  legend { font-weight: 700; padding: 0 0.25rem; }
  .opt { display: flex; align-items: center; gap: 0.5rem; min-height: $tap-min; }
  .opt input { width: 1.25rem; height: 1.25rem; accent-color: $cadmium-orange; }
  label:not(.opt) { display: grid; gap: 0.25rem; font-weight: 700; }
  select { min-height: $tap-min; }
  .hint { margin: 0; font-size: 0.875rem; }
</style>
