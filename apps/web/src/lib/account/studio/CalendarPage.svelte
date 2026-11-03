<!--
  Calendar: your parties as a month grid, a week, or a list. Hosting, going
  and invitations that need a reply each look different (edge style and a
  written tag, never color alone). Subscribe once and new parties show up in
  your own calendar app.
-->
<script lang="ts">
  import { subscribeLinks, type ScheduledParty } from '@ptc/shared';
  import { accountRequest } from '../account.svelte';
  import { act, go, studio, when } from './studio.svelte';
  import PartyCard from './PartyCard.svelte';
  import { isPast, statusOf, STATUS_TEXT } from './parties';

  type View = 'month' | 'week' | 'list';
  let view = $state<View>(readView());
  function readView(): View {
    try {
      const v = localStorage.getItem('ptc-calendar-view');
      return v === 'week' || v === 'list' ? v : 'month';
    } catch {
      return 'month';
    }
  }
  $effect(() => {
    try { localStorage.setItem('ptc-calendar-view', view); } catch { /* fine */ }
  });

  const today = new Date();
  let cursor = $state(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  let selectedId = $state<string | null>(null);
  let showPast = $state(false);

  let parties = $derived([...(studio.home?.parties ?? [])].filter((p) => statusOf(p) !== 'declined' || showPast).sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  let selected = $derived(parties.find((p) => p.id === selectedId) ?? null);
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  let byDay = $derived(parties.reduce<Record<string, ScheduledParty[]>>((all, p) => {
    (all[dayKey(new Date(p.startsAt))] ??= []).push(p);
    return all;
  }, {}));

  const weekStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  let monthDays = $derived.by(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = weekStart(first);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  });
  let weeks = $derived(Array.from({ length: 6 }, (_, w) => monthDays.slice(w * 7, w * 7 + 7)).filter((week, i) => i < 5 || week.some((d) => d.getMonth() === cursor.getMonth())));
  let weekDays = $derived(Array.from({ length: 7 }, (_, i) => { const s = weekStart(cursor); return new Date(s.getFullYear(), s.getMonth(), s.getDate() + i); }));
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 1 + i).toLocaleDateString(undefined, { weekday: 'short' }));

  function move(step: number) {
    cursor = view === 'week' ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + step * 7) : new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
  }
  let title = $derived(view === 'week'
    ? `Week of ${weekDays[0]!.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
    : cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  let listParties = $derived(parties.filter((p) => showPast || !isPast(p)));
  const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

  // ---------- subscribe ----------
  let feedUrl = $state('');
  let feedProblem = $state('');
  const apiBase = (import.meta.env.VITE_ACCOUNT_API_URL || location.origin).replace(/\/$/, '');
  $effect(() => {
    if (!studio.home?.profile || feedUrl) return;
    accountRequest<{ token: string }>('community/calendar').then((r) => (feedUrl = `${apiBase}/api/calendar/${r.token}.ics`), (e) => (feedProblem = e instanceof Error ? e.message : 'The calendar link is unavailable.'));
  });
  async function replaceFeed() {
    const r = await act<{ token: string }>('calendar/rotate', {}, 'New calendar link ready. Calendars using the old link stop updating.');
    if (r) feedUrl = `${apiBase}/api/calendar/${r.token}.ics`;
  }
  async function copyFeed() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      studio.notice = 'Calendar link copied.';
    } catch {
      studio.notice = 'Copying was blocked. Select the link and copy it yourself.';
    }
  }
</script>

<header class="page-head">
  <div><p class="eyebrow">Your parties</p><h1 tabindex="-1">Calendar</h1></div>
  <a class="btn" href="/account/parties/new" onclick={(e) => go('/account/parties/new', e)}>Plan a party</a>
</header>

<section class="card" aria-labelledby="cal-title">
  <div class="toolbar">
    <div class="choices" role="radiogroup" aria-label="Calendar view">
      <label><input type="radio" name="view" value="month" bind:group={view} />Month</label>
      <label><input type="radio" name="view" value="week" bind:group={view} />Week</label>
      <label><input type="radio" name="view" value="list" bind:group={view} />List</label>
    </div>
    {#if view !== 'list'}
      <div class="row nav">
        <button type="button" class="btn small quiet" onclick={() => move(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'}>‹</button>
        <h2 id="cal-title" aria-live="polite">{title}</h2>
        <button type="button" class="btn small quiet" onclick={() => move(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'}>›</button>
        <button type="button" class="btn small quiet" onclick={() => (cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>Today</button>
      </div>
    {:else}
      <h2 id="cal-title">All parties</h2>
    {/if}
    <label class="check past"><input type="checkbox" bind:checked={showPast} /><span>Show past and declined</span></label>
  </div>

  <ul class="legend" aria-label="What the styles mean">
    <li><span class="key hosting"></span>{STATUS_TEXT.hosting}</li>
    <li><span class="key going"></span>{STATUS_TEXT.going}</li>
    <li><span class="key invited"></span>{STATUS_TEXT.invited}</li>
  </ul>

  {#if view === 'month'}
    <table class="month">
      <caption class="sr">{title}. Choose a party to see its details.</caption>
      <thead><tr>{#each dayNames as day (day)}<th scope="col">{day}</th>{/each}</tr></thead>
      <tbody>
        {#each weeks as week, w (w)}
          <tr>
            {#each week as day (dayKey(day))}
              <td class:other={day.getMonth() !== cursor.getMonth()} class:today={sameDay(day, today)}>
                <span class="num"><span class="wd">{day.toLocaleDateString(undefined, { weekday: 'long', month: 'long' })} </span>{day.getDate()}<span class="sr"> {day.toLocaleDateString(undefined, { month: 'long' })}{sameDay(day, today) ? ', today' : ''}</span></span>
                {#each byDay[dayKey(day)] ?? [] as party (party.id)}
                  <button type="button" class="chip {statusOf(party)}" aria-pressed={selectedId === party.id} onclick={() => (selectedId = selectedId === party.id ? null : party.id)}>
                    <span class="time">{when(party.startsAt, 'time')}</span> {party.title}<span class="sr">, {STATUS_TEXT[statusOf(party)]}</span>
                  </button>
                {/each}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if view === 'week'}
    <ol class="week">
      {#each weekDays as day (dayKey(day))}
        <li class:today={sameDay(day, today)}>
          <h3>{day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
          {#each byDay[dayKey(day)] ?? [] as party (party.id)}
            <button type="button" class="chip {statusOf(party)}" aria-pressed={selectedId === party.id} onclick={() => (selectedId = selectedId === party.id ? null : party.id)}>
              <span class="time">{when(party.startsAt, 'time')}</span> {party.title}<span class="sr">, {STATUS_TEXT[statusOf(party)]}</span>
            </button>
          {:else}
            <p class="muted">Nothing planned.</p>
          {/each}
        </li>
      {/each}
    </ol>
  {:else}
    {#if listParties.length}
      <div class="stack">{#each listParties as party (party.id)}<PartyCard {party} />{/each}</div>
    {:else}
      <p class="empty">No parties yet. <a href="/account/parties/new" onclick={(e) => go('/account/parties/new', e)}>Plan one</a>.</p>
    {/if}
  {/if}
</section>

{#if selected && view !== 'list'}
  <section aria-label="Party details"><PartyCard party={selected} /></section>
{/if}

<section class="card stack" aria-labelledby="sub-title">
  <h2 id="sub-title">Add your parties to your calendar</h2>
  <p>Subscribe once: parties you host or say yes to show up in your calendar app and update on their own. (Each party card also has its own "Add to calendar".)</p>
  {#if feedUrl}
    <ul class="row sub-links">
      {#each subscribeLinks(feedUrl) as link (link.label)}<li><a class="btn small quiet" href={link.href} target={link.href.startsWith('webcal:') ? undefined : '_blank'} rel="noopener noreferrer">{link.label}</a></li>{/each}
    </ul>
    <label class="field">Or copy the link into any calendar app<input readonly value={feedUrl} onfocus={(e) => e.currentTarget.select()} /></label>
    <div class="row"><button type="button" class="btn small" onclick={copyFeed}>Copy link</button><button type="button" class="btn small quiet" onclick={replaceFeed}>Replace link</button></div>
    <p class="hint">Keep this link to yourself: anyone with it can see your party titles and times. Replace it if it gets out.</p>
  {:else if feedProblem}
    <p class="hint">{feedProblem}</p>
  {:else}
    <p class="hint">Getting your calendar link…</p>
  {/if}
</section>

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .nav h2 { margin: 0; min-width: 12ch; text-align: center; font-size: 22px; }
  .past { padding: 0; }
  .legend { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; }
  .legend li { display: flex; gap: 8px; align-items: center; }
  .key { width: 28px; height: 18px; border: 1px solid #8d7858; border-left-width: 6px; background: #fffaf0; }
  .key.hosting, .chip.hosting { border-left-color: #ad175b; background: #fbe3ee; }
  .key.going, .chip.going { border-left-color: #07616a; background: #dff0ee; }
  .key.invited, .chip.invited { border-left-color: #c98a00; border-left-style: double; border-left-width: 8px; background: #fff4cf; }
  .chip.cancelled, .chip.declined { text-decoration: line-through; border-left-style: dashed; }
  .month { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 4px; text-align: left; }
  td { vertical-align: top; height: 104px; padding: 4px; border: 1px solid #c8b695; background: #fffaf0; }
  td.other { background: #f1e8d4; color: #6b604f; }
  td.today { outline: 3px solid #2a261e; outline-offset: -3px; }
  .num { display: block; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .wd { display: none; }
  .chip { display: block; width: 100%; min-height: 32px; margin-bottom: 4px; padding: 4px 6px; text-align: left; font: inherit; font-size: 13px; line-height: 1.25; color: #2a261e; border: 1px solid #8d7858; border-left-width: 6px; cursor: pointer; overflow-wrap: anywhere; }
  .chip[aria-pressed='true'] { box-shadow: 0 0 0 2px #2a261e; }
  .time { font-weight: 700; }
  .week { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
  .week li { padding: 8px; min-height: 140px; background: #fffaf0; border: 1px solid #c8b695; }
  .week li.today { outline: 3px solid #2a261e; outline-offset: -3px; }
  .week h3 { font-size: 15px; }
  .sub-links { list-style: none; padding: 0; margin: 0; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  /* Narrow screens: the month grid becomes a list of days that have parties. */
  @media (max-width: 720px) {
    .month thead { display: none; }
    .month, .month tbody, .month tr, .month td { display: block; width: 100%; }
    .month td { height: auto; border-width: 0 0 1px; }
    .month td:not(:has(.chip)) { display: none; }
    .wd { display: inline; }
    .num .sr { display: none; }
    .week { grid-template-columns: minmax(0, 1fr); }
    .week li { min-height: 0; }
  }
</style>
