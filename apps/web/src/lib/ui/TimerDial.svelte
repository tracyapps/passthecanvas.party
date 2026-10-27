<!-- The kitchen-timer countdown. The dial empties as time runs out. -->
<script lang="ts">
  import { clockText } from '@ptc/shared';

  interface Props {
    secondsLeft: number;
    totalSeconds: number;
    label: string; // e.g. "Your turn" or "Jordan's turn"
  }
  let { secondsLeft, totalSeconds, label }: Props = $props();

  let degrees = $derived(Math.round((360 * Math.max(0, secondsLeft)) / Math.max(1, totalSeconds)));
  let low = $derived(secondsLeft <= 10);
</script>

<!-- role="timer" is not announced every second; turn changes are announced separately. -->
<div class="timer" role="timer" aria-label="Time left this turn" class:low>
  <span class="dial" aria-hidden="true" style:--deg="{degrees}deg"><span class="knob"></span></span>
  <span class="text">
    <span class="label">{label}</span>
    <span class="clock">{clockText(secondsLeft)}</span>
  </span>
</div>

<style lang="scss">
  @use '../../styles/tokens' as *;

  .timer {
    display: inline-flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.375rem 1rem 0.375rem 0.375rem;
    border-radius: $radius-pill;
    background: $cream;
    color: $walnut-900;
    box-shadow:
      inset 0 -3px 0 rgb(0 0 0 / 0.12),
      0 4px 12px rgb(0 0 0 / 0.35);
  }

  .dial {
    --fill: #{$cadmium-orange};
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: conic-gradient(var(--fill) var(--deg), #e2d4b8 0deg);
    box-shadow: inset 0 0 0 3px #fff8ea;
  }

  .knob {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #fff8ea;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .label {
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #5c4632;
  }

  .clock {
    font-family: $font-display;
    font-weight: 800;
    font-size: 1.75rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .low {
    .dial {
      --fill: #c2410c;
    }
    .clock {
      color: $alizarin;
    }
  }
</style>
