<script lang="ts">
  import type { StudioAvatar } from '@ptc/shared';
  let { avatar, name = 'Studio avatar' }: { avatar: StudioAvatar; name?: string } = $props();
  const colors = { magenta: '#ad175b', teal: '#07616a', violet: '#6336a5', gold: '#946000' };
</script>
<svg viewBox="0 0 120 120" role="img" aria-label={name}>
  <path d="M13 8 110 12 105 111 8 105Z" fill="#fff2cf"/>
  <path d="M19 15 104 18 98 104 15 98Z" fill={colors[avatar.color]}/>
  <g fill="none" stroke="#fff2cf" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    {#if avatar.mark === 'brush'}<path d="m42 78 34-40 8 7-32 43Z"/><path d="M46 81q-22-7-23 14 18 4 23-14Z" fill="#fff2cf"/>
    {:else if avatar.mark === 'star'}<path d="m60 26 9 23 25 2-19 16 5 25-20-14-22 13 6-25-18-16 25-1Z"/>
    {:else if avatar.mark === 'cat'}<path d="m32 64 1-33 22 13 14-1 20-13-2 36q-2 24-28 25T32 64Z"/><path d="M46 62h1m23 0h1m-16 9 6 5 6-5M27 72l17 3m36 0 15-3"/>
    {:else}<path d="M30 74q-5-53 41-43t9 48-31-17 22-6"/>{/if}
  </g>
</svg>
<style>svg { display:block; width:100%; height:auto; filter:drop-shadow(2px 4px 2px #0003); }</style>
