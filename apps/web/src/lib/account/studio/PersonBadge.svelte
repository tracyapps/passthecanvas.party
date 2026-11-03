<!--
  Someone's picture: their profile photo, or their initials on the color
  they chose. Decorative by default (the name is always written nearby);
  pass `label` when it stands alone.
-->
<script lang="ts">
  import { INITIALS_COLORS, initialsOf, type InitialsColor } from '@ptc/shared';
  import { photoUrl } from './studio.svelte';

  interface Props {
    person: { id: string; name: string; photo: string | null; avatar: { color: InitialsColor } };
    size?: number;
    label?: string;
    /** A local preview (a photo chosen but not uploaded yet). */
    preview?: string | null;
  }
  let { person, size = 56, label, preview = null }: Props = $props();
  let src = $derived(preview ?? photoUrl(person.id, person.photo));
  let fill = $derived(INITIALS_COLORS[person.avatar.color]?.fill ?? INITIALS_COLORS.teal.fill);
</script>

<span class="badge" style:--size={`${size}px`} style:--fill={fill} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {#if src}<img {src} alt="" />{:else}<span class="initials">{initialsOf(person.name)}</span>{/if}
</span>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    overflow: hidden;
    background: var(--fill);
    color: #fff;
    box-shadow: 0 0 0 3px #fff6e4, 1px 3px 6px #2a1d1240;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .initials {
    font-family: 'Viga', sans-serif;
    font-size: calc(var(--size) * 0.4);
    letter-spacing: 0.02em;
    line-height: 1;
  }
</style>
