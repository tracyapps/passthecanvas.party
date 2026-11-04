<!--
  One scheduled party: when, who's hosting, your status, and what you can do
  (RSVP, add it to a calendar, open the room; hosts can edit and invite).
-->
<script lang="ts">
  import type { ScheduledParty } from '@ptc/shared';
  import { act, go, when } from './studio.svelte';
  import { calendarLinks, downloadIcs, isLive, isPast, roomLink, statusOf, STATUS_TEXT, timingSummary } from './parties';

  let { party, compact = false }: { party: ScheduledParty; compact?: boolean } = $props();
  let status = $derived(statusOf(party));
  let past = $derived(isPast(party));
  let live = $derived(isLive(party));
  let soon = $derived(new Date(party.startsAt).getTime() - Date.now() < 60 * 60_000 && !past);
</script>

<article class="party" class:compact data-status={status}>
  <div class="date" aria-hidden="true">
    <span class="month">{new Date(party.startsAt).toLocaleDateString(undefined, { month: 'short' })}</span>
    <span class="day">{new Date(party.startsAt).getDate()}</span>
  </div>
  <div class="body">
    <h3>{party.title}</h3>
    <p class="meta">{when(party.startsAt)} · {party.hosting ? 'Hosted by you' : `Hosted by ${party.hostName}`}</p>
    <p><span class="tag {status}">{STATUS_TEXT[status]}</span>{#if live} <span class="tag live">Happening now</span>{/if}</p>
    {#if !compact}
      {#if party.settings.description}<p class="description">{party.settings.description}</p>{/if}
      <p class="muted">{timingSummary(party)}</p>
    {/if}
    {#if !party.cancelled && !past}
      <div class="row actions">
        {#if status === 'invited' || status === 'declined' || status === 'going'}
          {#if status !== 'going'}<button type="button" class="btn small" onclick={() => void act('parties/respond', { party: party.id, response: 'yes' }, `RSVP saved: going to ${party.title}.`)}>I'm going</button>{/if}
          {#if status !== 'declined'}<button type="button" class="btn small quiet" onclick={() => void act('parties/respond', { party: party.id, response: 'no' }, `RSVP saved: not going to ${party.title}.`)}>Can't make it</button>{/if}
        {/if}
        {#if party.hosting}<a class="btn small quiet" href={`/account/parties/${party.id}`} onclick={(e) => go(`/account/parties/${party.id}`, e)}>Edit & invite</a>{/if}
        {#if status !== 'declined'}<a class="btn small" class:quiet={!soon && !live} href={roomLink(party)}>{live ? 'Join the party now' : soon ? 'Join the party room' : 'Party room link'}</a>{/if}
        <details class="add">
          <summary class="btn small quiet">Add to calendar</summary>
          <ul class="list menu">
            {#each calendarLinks(party) as link (link.label)}<li><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a></li>{/each}
            <li><button type="button" class="link-button" onclick={() => downloadIcs(party)}>Apple Calendar or other (.ics file)</button></li>
          </ul>
        </details>
      </div>
    {/if}
  </div>
</article>

<style>
  .party {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 16px;
    padding: 16px;
    background: #fffaf0;
    border: 1px solid #c8b695;
    border-left: 6px solid #8d7858;
  }
  /* Hosting, going and invited each get a different edge (and a written tag). */
  [data-status='hosting'] { border-left-color: #ad175b; }
  [data-status='going'] { border-left-color: #07616a; }
  [data-status='invited'] { border-left-color: #c98a00; background: #fff4cf; border-left-style: double; border-left-width: 8px; }
  [data-status='cancelled'], [data-status='declined'] { opacity: 0.8; border-left-style: dashed; }
  .tag.live { background: #2f6b2f; color: #fff; border-color: #2f6b2f; }
  .date {
    display: grid;
    place-content: center;
    text-align: center;
    background: #2a261e;
    color: #fff6e5;
    height: 64px;
    line-height: 1.05;
  }
  .month { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
  .day { font-family: 'Viga', sans-serif; font-size: 26px; }
  h3 { margin: 0 0 2px; overflow-wrap: anywhere; }
  .meta { margin: 0 0 8px; font-size: 15px; }
  p { margin: 0 0 8px; }
  .description { white-space: pre-line; }
  .actions { margin-top: 8px; }
  .add { position: relative; }
  .add summary { list-style: none; }
  .add summary::-webkit-details-marker { display: none; }
  .menu {
    position: absolute;
    z-index: 5;
    top: calc(100% + 4px);
    left: 0;
    min-width: 16rem;
    padding: 8px 14px;
    background: #fffaf0;
    border: 1px solid #8d7858;
    box-shadow: 2px 8px 14px #27180e35;
  }
  .menu li { padding: 0; border: 0; }
  .menu a { display: flex; align-items: center; min-height: 44px; }
  .compact { grid-template-columns: 52px minmax(0, 1fr); padding: 12px; }
  .compact .date { height: 52px; }
</style>
