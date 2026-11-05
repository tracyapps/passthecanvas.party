<script lang="ts">
  import PublicSupport from './PublicSupport.svelte';
  import TiltLogo from './TiltLogo.svelte';
  import LegalPages from './LegalPages.svelte';
  import PartyJourney from './PartyJourney.svelte';
  import { site, navigation, pages, partySteps, workbench } from './public-site-content';
  import '../../styles/public-site.scss';
  import PersonBadge from '../account/studio/PersonBadge.svelte';
  import { accountState, initializeAccount, openAccountSignUp } from '../account/account.svelte';
  import { refresh, studio } from '../account/studio/studio.svelte';
  // The header shows who's signed in ("Tapps' studio" with their picture) or a sign-in link.
  $effect(() => { const id = setTimeout(() => void initializeAccount(), 300); return () => clearTimeout(id); });
  $effect(() => { if (accountState.userId && !studio.home && !studio.loading) void refresh(); });
  let me = $derived(accountState.userId ? studio.home?.profile ?? null : null);
  const possessive = (name: string) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);
  // The one main action: make a free account; once you have one, plan a party.
  // (Without sign-in wired up, e.g. a preview build, the button goes to the studio page instead.)
  function signUp(event: MouseEvent) {
    if (!accountState.configured) return;
    event.preventDefault();
    void openAccountSignUp();
  }
  let studioLabel = $derived(me ? `${possessive(me.name)} studio` : accountState.userId ? 'Your studio' : 'Log in to your studio');
  let { path = '/' }: { path?: string } = $props();
  let page = $derived(pages[path] ?? (path.startsWith('/account') ? pages['/account'] : pages['/']));
  let roomDialog: HTMLDialogElement;
  let roomOpen = $state(false);
  let dark = $state(document.documentElement.dataset.siteTheme === 'dark');
  function toggleTheme() {
    dark = !dark;
    document.documentElement.dataset.siteTheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#24231f' : '#f5edda');
    try { localStorage.setItem('ptc-site-theme-v1', dark ? 'dark' : 'light'); } catch { /* Keep the choice for this page even without storage. */ }
  }
  let trinketMessage = $state('');
  function explore() { roomOpen = true; roomDialog.showModal(); }
  function closeRoom() { roomDialog.close(); roomOpen = false; }
  function comfort() { trinketMessage = trinketMessage ? '' : 'This is your emotional support reminder: it is allowed to look weird.'; }
</script>

<svelte:head>
  <title>{path === '/' ? 'Pass the Canvas — Make something. Together.' : `${page.title} — Pass the Canvas`}</title>
</svelte:head>

<div class="public-site">
  <a class="public-skip" href="#main-content">Skip to content</a>
  <header class="site-header">
    <TiltLogo />
    <nav class="desktop-nav" aria-label="Main navigation">{#each navigation as link}<a href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>{/each}<a href="/try" aria-current={path === '/try' ? 'page' : undefined}>Try the paints</a></nav>
    <div class="header-actions"><button class="theme-toggle" type="button" aria-label="Dark appearance" title={dark ? 'Dark appearance (on)' : 'Dark appearance (off)'} aria-pressed={dark} onclick={toggleTheme}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg></button><a href="/account" class="account-link" class:signed-in={!!me} aria-label={studioLabel}>{#if me}<PersonBadge person={me} size={32} />{/if}<span>{studioLabel}</span></a>{#if accountState.userId}<a href="/account/parties/new" class="paint-link">Plan a party</a>{:else}<a href="/account" class="paint-link" onclick={signUp}>Create a free account</a>{/if}</div>
    <details class="mobile-nav"><summary>Explore</summary><nav aria-label="Mobile navigation">{#each navigation as link}<a href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>{/each}<a href="/try">Try the paints</a><a href="/account">{studioLabel}</a>{#if accountState.userId}<a href="/account/parties/new">Plan a party</a>{:else}<a href="/account" onclick={signUp}>Create a free account</a>{/if}<a href="/support">Support the studio</a></nav></details>
  </header>

  <main id="main-content">
  {#if path === '/'}
    <section class="studio-hero" aria-labelledby="home-title">
      <div class="hero-room">{#await import('./PublicStudio.svelte')}{:then { default: PublicStudio }}<PublicStudio hero />{/await}</div>
      <div class="hero-poster paper">
        <span class="tape top-tape" aria-hidden="true"></span>
        <p class="eyebrow">Pull up a chair. Make a little mess.</p>
        <h1 id="home-title">Make<br/>something.<br/><em>Together.</em></h1>
        <p class="hero-description">{site.description}</p>
        <div class="hero-actions">{#if accountState.userId}<a href="/account/parties/new" class="ink-button">Plan a party <span aria-hidden="true">↗</span></a>{:else}<a href="/account" class="ink-button" onclick={signUp}>Create your free account <span aria-hidden="true">↗</span></a>{/if}<a href="/how-it-works" class="text-link">Wait, how does this work?</a></div>
        <p class="handwritten hero-note">No masterpiece required.</p>
      </div>
    </section>

    <section class="manifesto wall-section">
      <div class="manifesto-copy"><p class="eyebrow">For the “I can’t even draw a stick figure” crowd.</p><h2>You don’t have to be<br/><em>good at art.</em><br/>You just have to be here.</h2><p>Somewhere along the way, making things got serious. We started worrying about getting it right. About being talented. About what other people would think.</p><p>Let’s put that down for a minute.</p><p>Pass the Canvas is being made for the joy of making things with other people. An unexpected color. A ridiculous idea. A friend who turns your squiggle into something you never saw coming.</p><a href="/how-it-works" class="text-link">Meet your next favorite kind of party <span aria-hidden="true">→</span></a></div>
      <aside class="studio-shelf"><div class="permission-slip paper"><span class="tape" aria-hidden="true"></span><p class="eyebrow">Your permission slip</p><p class="handwritten">Make a mess.<br/>Change your mind.<br/>Paint over it.<br/>Leave the weird bit.</p><span class="stamp">ART IS FOR EVERYONE.</span></div><button class="trinket" type="button" onclick={comfort} aria-label="Ask the emotional support dumpster for encouragement"><img src="/site/studio-friends.webp" alt="A crocheted flaming dumpster, a rubber duck and a pink cassette." loading="lazy" width="600" height="400"/></button><p class="trinket-caption handwritten">emotional support art supplies</p><p class="trinket-message" aria-live="polite">{trinketMessage}</p></aside>
    </section>

    <section class="party-invitation stacked wood-section">
      <div class="invitation-heading"><p class="eyebrow">A painting party. With a plot twist.</p><h2>You start it.<br/>Your friends<br/><em>take it somewhere.</em></h2><p>One canvas for each person. A circle of friends. A painting that gets a little more unexpected with every pass.</p><a href="/how-it-works" class="cream-button">See how a party will work <span aria-hidden="true">→</span></a></div>
      <div class="journey-wrap"><PartyJourney /></div>
    </section>

    <section class="try-section wall-section"><div class="section-intro"><p class="eyebrow">The table is already set.</p><h2>Go on.<br/><em>Try a little something.</em></h2><p>No account. No audience. Just you and the art supplies.</p></div>{#await import('./PublicPaint.svelte')}<p class="loading-note">Setting out the paints…</p>{:then { default: PublicPaint }}<PublicPaint compact />{/await}<p class="preview-footnote">A local paint preview. Marks stay in this tab and disappear when you leave. <a href="/try">Open the full paint table</a></p></section>

    <section class="gallery-intro wall-section"><div><p class="eyebrow">It belongs on a wall.</p><h2>Even the<br/><em>happy accidents.</em></h2><p>Eventually, your party’s art will live here in its own gallery. For now, here’s how one canvas grew, round by round.</p><a href="/gallery" class="ink-button">Wander through the gallery <span aria-hidden="true">↗</span></a></div><figure class="little-art paper"><img src="/site/journey-5.webp" width="900" height="900" loading="lazy" decoding="async" alt="A lime green dragon in a tall orange top hat, with orange wings, googly eyes and a toothy grin, in front of a purple and orange sunset, a dark pine tree and a little blue bird." /><figcaption class="handwritten">“It started as a sunset.”<span>Five painters, one canvas · studio example</span></figcaption></figure></section>

    <section class="closing-note paper"><p class="eyebrow">Still a work in progress. Aren’t we all?</p><h2>A little more play.<br/>A little less perfect.</h2><p>The paint preview is open. The full party, private galleries and saved replays are still being made. Come see what’s on the table.</p><a href="/roadmap" class="text-link">Peek at the workbench <span aria-hidden="true">→</span></a></section>

  {:else if path === '/how-it-works'}
    <section class="page-opening wall-section"><p class="eyebrow">The idea is simple. The art gets interesting.</p><h1>A painting party.<br/><em>With a plot twist.</em></h1><p class="lead">You bring your people. Everybody starts a painting. Then you pass them around.</p><p class="development-note">This is the party we’re building. You can try the paints today; hosted multiplayer, saved replays and personal galleries are still in development.</p></section>
    <section class="journey-section wall-section" aria-labelledby="journey-title"><h2 id="journey-title">One canvas. Five friends.<br/><em>From hinged to unhinged.</em></h2><p class="lead">Everybody paints on top of everybody else. Somebody makes a careful sunset. Somebody adds a tree. Then somebody adds a dragon. In a hat. All of it counts.</p><PartyJourney /></section>
    <section class="how-paper wall-section" aria-label="How a party will work"><ol>{#each partySteps as step}<li><span class="step-number">{step.number}</span><div><h2>{step.title}</h2><p>{step.detail}</p></div></li>{/each}</ol><aside class="margin-note paper"><p class="handwritten">The timer is a nudge.<br/>Not a jump scare.</p><p>The host chooses the pace. We’re designing a gentle finish-and-pass cue, so nobody gets punished for enjoying the painting.</p><a href="/try" class="ink-button">Try your first squiggle</a></aside></section>
    <section class="faq-section wall-section"><h2>Before you pull up a chair.</h2>{#each [{q:'Do I have to know how to paint?',a:'No. That is very much the point. Dots, scribbles, shapes, color and questionable artistic decisions are all welcome.'},{q:'Do I need Discord?',a:'No. The account plan includes email sign-in with optional Discord. A Discord account will never be a requirement for making art here.'},{q:'Do I have to turn on my camera?',a:'No. Video and avatar presence are both part of the party plan. Being on camera is not the price of being included.'},{q:'Is the call recorded?',a:'No. Creation playback is about the artwork: paint marks and their order. We do not record video or audio.'},{q:'Can I host a party right now?',a:'Not yet. This public version is a paint-and-studio preview. Room hosting, the passing circle and saved party artwork are still being connected.'}] as question}<details><summary>{question.q}</summary><p>{question.a}</p></details>{/each}</section>

  {:else if path === '/gallery'}
    <section class="page-opening wall-section"><p class="eyebrow">The gallery is coming soon.</p><h1>Every painting<br/><em>has a story.</em></h1><p class="lead">Soon, art from real parties will hang here. Until then, here’s one canvas and its whole journey, from a careful sunset to a dragon in a hat.</p></section>
    <section class="journey-section wall-section" aria-label="Featured: one canvas, five painters"><PartyJourney mode="stepper" /></section>
    <section class="gallery-bottom wall-section"><h2>Your party’s art<br/><em>could hang here first.</em></h2><p>Make a free account, plan a party with your people, and your pieces could be some of the first on the wall. (You choose what gets shared.)</p>{#if accountState.userId}<a href="/account/parties/new" class="ink-button">Plan a party <span aria-hidden="true">↗</span></a>{:else}<a href="/account" class="ink-button" onclick={signUp}>Create your free account <span aria-hidden="true">↗</span></a>{/if}<button class="text-link" type="button" onclick={explore}>Step inside the studio</button></section>

  {:else if path === '/try'}
    <section class="page-opening wall-section"><p class="eyebrow">No audience. No timer. No account.</p><h1>No masterpiece<br/><em>required.</em></h1><p class="lead">Pick a color. Follow a line. See what happens.</p></section>
    <section class="full-paint">{#await import('./PublicPaint.svelte')}<p class="loading-note">Setting out the paints…</p>{:then { default: PublicPaint }}<PublicPaint />{/await}</section>
    <div class="paint-afterword wall-section"><p>Just a little practice space. Your marks stay in this tab, aren’t uploaded, and disappear when you leave or reload. The full studio’s mixing trays, water and other tools are still being refined.</p><a class="text-link" href="/how-it-works">Now imagine passing that canvas to a friend <span aria-hidden="true">→</span></a></div>

  {:else if path === '/roadmap'}
    <section class="page-opening wall-section"><p class="eyebrow">A few paint stains. A lot of possibilities.</p><h1>Still making<br/><em>things.</em></h1><p class="lead">Here’s what’s ready to play with, what’s being connected, and what’s in the someday pile.</p><p>Small steps. Real progress. No made-up launch dates.</p></section>
    <section class="roadmap-board wood-section" aria-label="Product roadmap">{#each workbench as note,index}<article class="roadmap-note paper" style:--tilt={`${index % 2 ? 1.4 : -1.2}deg`}><span class="tape" aria-hidden="true"></span><p class="eyebrow">{note.state}</p><h2>{note.title}</h2><ul>{#each note.items as item}<li>{item}</li>{/each}</ul></article>{/each}</section>
    <section class="closing-note paper"><h2>Want to help this<br/>little studio grow?</h2><p>Try the preview. Tell a friend. Cheer on a very enthusiastic work in progress.</p><a href="/support" class="text-link">Support the studio <span aria-hidden="true">→</span></a></section>

  {:else if path === '/support'}
    <section class="page-opening support-opening wall-section"><div><p class="eyebrow">Independently made. A little paint-covered.</p><h1>Help keep<br/><em>the paint flowing.</em></h1><p class="lead">Hi. I’m Tapps. I’m making a place for people to make things together.</p><p>This started with wanting a better way for my church community to have virtual art parties. And the very strong belief that making art belongs to everybody.</p><p>Not just people who already think they’re good at it.</p><div class="support-slip paper"><PublicSupport /></div><a class="text-link" href={site.contactUrl} rel="noopener noreferrer">Questions or feedback? Get in touch <span aria-hidden="true">↗</span></a></div><div class="support-friends"><button type="button" class="trinket" onclick={comfort} aria-label="Get encouragement from the emotional support dumpster"><img src="/site/studio-friends.webp" alt="The studio’s very supportive crocheted dumpster, rubber duck and cassette." width="600" height="400"/></button><p class="handwritten">The studio support department.</p><p aria-live="polite">{trinketMessage}</p></div></section>

  {:else if path === '/account' || path.startsWith('/account/')}
    <!-- Your studio: each page brings its own heading, so there's no big opening here. -->
    <section class="account-opening studio-wall wall-section">{#await import('../account/studio/AccountApp.svelte')}<p>Opening your studio…</p>{:then { default: AccountApp }}<AccountApp />{/await}</section>

  {:else if path === '/privacy' || path === '/terms'}
    <LegalPages page={path === '/privacy' ? 'privacy' : 'terms'} />
  {/if}
  </main>

  <footer class="site-footer wood-section"><div><a href="/" class="footer-title">Pass the Canvas<span class="handwritten">Make something. Together.</span></a><p>An art party for all of us.<br/>Especially the “I’m not an artist” ones.</p></div><nav aria-label="Footer navigation"><a href="/how-it-works">How it works</a><a href="/gallery">Gallery</a><a href="/roadmap">Roadmap</a><a href="/support">Donate to the developer</a><a href="/account">Your studio</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href={site.contactUrl} rel="noopener noreferrer">Contact</a></nav><p class="footer-colophon">Made by Tapps. Still a little paint-covered.<br/>Public preview · {new Date().getFullYear()}</p></footer>
  <dialog class="studio-dialog" aria-labelledby="public-room-title" bind:this={roomDialog} onclose={() => roomOpen = false}><div class="dialog-heading"><h2 id="public-room-title">Around the studio</h2><button type="button" onclick={closeRoom} aria-label="Close studio preview">Close <span aria-hidden="true">×</span></button></div>{#if roomOpen}{#await import('./PublicStudio.svelte')}<p class="loading-note">Opening the studio…</p>{:then { default: PublicStudio }}<PublicStudio />{/await}{/if}</dialog>
</div>
