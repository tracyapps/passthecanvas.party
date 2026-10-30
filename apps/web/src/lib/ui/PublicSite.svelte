<script lang="ts">
  import PublicSupport from './PublicSupport.svelte';
  import { site, navigation, pages, partySteps, workbench } from './public-site-content';
  import '../../styles/public-site.scss';
  let { path = '/' }: { path?: string } = $props();
  let page = $derived(pages[path] ?? pages['/']);
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
    <a class="wordmark" href="/" aria-label="Pass the Canvas home"><svg viewBox="0 0 46 46" aria-hidden="true"><path d="M7 6l30 3-2 29-29-2z" fill="#f0bb36" stroke="currentColor" stroke-width="2"/><path d="M14 15q9-9 17 1t-9 7-8 9" fill="none" stroke="#bc395f" stroke-width="5" stroke-linecap="round"/></svg><span>PASS THE<br/>CANVAS<span class="wordmark-dot">.party</span></span></a>
    <nav class="desktop-nav" aria-label="Main navigation">{#each navigation as link}<a href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>{/each}</nav>
    <div class="header-actions"><button class="theme-toggle" type="button" aria-label="Dark appearance" aria-pressed={dark} onclick={toggleTheme}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/></svg><span>{dark ? 'Dark' : 'Light'}</span></button><a href="/account" class="account-link">Your studio</a><a href="/try" class="paint-link">Try the paints <span aria-hidden="true">↗</span></a></div>
    <details class="mobile-nav"><summary>Explore</summary><nav aria-label="Mobile navigation">{#each navigation as link}<a href={link.href} aria-current={path === link.href ? 'page' : undefined}>{link.label}</a>{/each}<a href="/account">Your studio</a><a href="/support">Support the studio</a></nav></details>
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
        <div class="hero-actions"><a href="/try" class="ink-button">Get a little paint on your hands <span aria-hidden="true">↗</span></a><a href="/how-it-works" class="text-link">Wait, how does this work?</a></div>
        <p class="handwritten hero-note">No masterpiece required.</p>
      </div>
    </section>

    <section class="manifesto wall-section">
      <div class="manifesto-copy"><p class="eyebrow">For the “I can’t even draw a stick figure” crowd.</p><h2>You don’t have to be<br/><em>good at art.</em><br/>You just have to be here.</h2><p>Somewhere along the way, making things got serious. We started worrying about getting it right. About being talented. About what other people would think.</p><p>Let’s put that down for a minute.</p><p>Pass the Canvas is being made for the joy of making things with other people. An unexpected color. A ridiculous idea. A friend who turns your squiggle into something you never saw coming.</p><a href="/how-it-works" class="text-link">Meet your next favorite kind of party <span aria-hidden="true">→</span></a></div>
      <aside class="studio-shelf"><div class="permission-slip paper"><span class="tape" aria-hidden="true"></span><p class="eyebrow">Your permission slip</p><p class="handwritten">Make a mess.<br/>Change your mind.<br/>Paint over it.<br/>Leave the weird bit.</p><span class="stamp">ART IS FOR EVERYONE.</span></div><button class="trinket" type="button" onclick={comfort} aria-label="Ask the emotional support dumpster for encouragement"><img src="/site/studio-friends.webp" alt="A crocheted flaming dumpster, a rubber duck and a pink cassette." loading="lazy" width="600" height="400"/></button><p class="trinket-caption handwritten">emotional support art supplies</p><p class="trinket-message" aria-live="polite">{trinketMessage}</p></aside>
    </section>

    <section class="party-invitation wood-section">
      <div class="invitation-heading"><p class="eyebrow">A painting party. With a plot twist.</p><h2>You start it.<br/>Your friends<br/><em>take it somewhere.</em></h2><p>One canvas for each person. A circle of friends. A painting that gets a little more unexpected with every pass.</p><a href="/how-it-works" class="cream-button">See how a party will work <span aria-hidden="true">→</span></a></div>
      <div class="passing-sketch" aria-label="The planned canvas-passing circle"><article class="passing-paper paper"><span class="handwritten">your beginning</span><svg viewBox="0 0 300 220" aria-hidden="true"><path d="M35 170Q65 40 140 130T270 70" fill="none" stroke="#df5c3b" stroke-width="30" stroke-linecap="round"/><path d="M50 165Q160 70 240 150" fill="none" stroke="#177d83" stroke-width="24" stroke-linecap="round"/></svg><small>A squiggle is a perfectly good beginning.</small></article><div class="passing-arrow handwritten" aria-hidden="true">pass it on ↷</div><article class="passing-paper paper second-paper"><span class="handwritten">their next idea</span><svg viewBox="0 0 300 220" aria-hidden="true"><path d="M35 170Q65 40 140 130T270 70" fill="none" stroke="#df5c3b" stroke-width="30" stroke-linecap="round"/><path d="M50 165Q160 70 240 150" fill="none" stroke="#177d83" stroke-width="24" stroke-linecap="round"/><path d="M50 170l15-70 20 70m80-65q30-60 60 0" fill="none" stroke="#373477" stroke-width="9" stroke-linecap="round"/><circle cx="180" cy="55" r="20" fill="#e9b735"/></svg><small>Suddenly it’s a landscape. Or a very good dog.</small></article></div>
    </section>

    <section class="try-section wall-section"><div class="section-intro"><p class="eyebrow">The table is already set.</p><h2>Go on.<br/><em>Try a little something.</em></h2><p>No account. No audience. Just you and the art supplies.</p></div>{#await import('./PublicPaint.svelte')}<p class="loading-note">Setting out the paints…</p>{:then { default: PublicPaint }}<PublicPaint compact />{/await}<p class="preview-footnote">A local paint preview. Marks stay in this tab and disappear when you leave. <a href="/try">Open the full paint table</a></p></section>

    <section class="gallery-intro wall-section"><div><p class="eyebrow">It belongs on a wall.</p><h2>Even the<br/><em>happy accidents.</em></h2><p>Eventually, your party’s art will live here in its own gallery. For now, watch a few examples come together.</p><a href="/gallery" class="ink-button">Wander through the gallery <span aria-hidden="true">↗</span></a></div><figure class="little-art paper"><svg viewBox="0 0 440 320" role="img" aria-label="An illustrative abstract painting in turquoise, poppy, magenta and yellow"><rect width="440" height="320" fill="#f5ecdc"/><path d="M25 220Q140 30 340 200T460 60" fill="none" stroke="#dd633e" stroke-width="85" stroke-linecap="round"/><path d="M70 310Q40 30 250 200T430 240" fill="none" stroke="#177b80" stroke-width="56"/><path d="M60 80Q300 0 280 250" fill="none" stroke="#b63872" stroke-width="22"/><circle cx="318" cy="95" r="35" fill="#e8b533"/></svg><figcaption class="handwritten">“We went with it.”<span>Illustrative studio example</span></figcaption></figure></section>

    <section class="closing-note paper"><p class="eyebrow">Still a work in progress. Aren’t we all?</p><h2>A little more play.<br/>A little less perfect.</h2><p>The paint preview is open. The full party, private galleries and saved replays are still being made. Come see what’s on the table.</p><a href="/roadmap" class="text-link">Peek at the workbench <span aria-hidden="true">→</span></a></section>

  {:else if path === '/how-it-works'}
    <section class="page-opening wall-section"><p class="eyebrow">The idea is simple. The art gets interesting.</p><h1>A painting party.<br/><em>With a plot twist.</em></h1><p class="lead">You bring your people. Everybody starts a painting. Then you pass them around.</p><p class="development-note">This is the party we’re building. You can try the paints today; hosted multiplayer, saved replays and personal galleries are still in development.</p></section>
    <section class="how-paper wall-section" aria-label="How a party will work"><ol>{#each partySteps as step}<li><span class="step-number">{step.number}</span><div><h2>{step.title}</h2><p>{step.detail}</p></div></li>{/each}</ol><aside class="margin-note paper"><p class="handwritten">The timer is a nudge.<br/>Not a jump scare.</p><p>The host chooses the pace. We’re designing a gentle finish-and-pass cue, so nobody gets punished for enjoying the painting.</p><a href="/try" class="ink-button">Try your first squiggle</a></aside></section>
    <section class="faq-section wall-section"><h2>Before you pull up a chair.</h2>{#each [{q:'Do I have to know how to paint?',a:'No. That is very much the point. Dots, scribbles, shapes, color and questionable artistic decisions are all welcome.'},{q:'Do I need Discord?',a:'No. The account plan includes email sign-in with optional Discord. A Discord account will never be a requirement for making art here.'},{q:'Do I have to turn on my camera?',a:'No. Video and avatar presence are both part of the party plan. Being on camera is not the price of being included.'},{q:'Is the call recorded?',a:'No. Creation playback is about the artwork: paint marks and their order. We do not record video or audio.'},{q:'Can I host a party right now?',a:'Not yet. This public version is a paint-and-studio preview. Room hosting, the passing circle and saved party artwork are still being connected.'}] as question}<details><summary>{question.q}</summary><p>{question.a}</p></details>{/each}</section>

  {:else if path === '/gallery'}
    <section class="page-opening wall-section"><p class="eyebrow">An excellent place for happy accidents.</p><h1>Every painting<br/><em>has a story.</em></h1><p class="lead">A final piece is lovely. Watching a little chaos turn into something is even better.</p><p class="development-note">An example wall, for now. These are illustrative paintings with sample playback—not work from real parties. Private party galleries and saved-stroke replay are on the workbench.</p></section>
    {#await import('./PublicGallery.svelte')}<p class="loading-note">Hanging the paintings…</p>{:then { default: PublicGallery }}<PublicGallery />{/await}
    <section class="gallery-bottom wall-section"><h2>Imagine what your<br/><em>friends will add.</em></h2><button class="ink-button" type="button" onclick={explore}>Step inside the studio <span aria-hidden="true">↗</span></button><a href="/try" class="text-link">Make a little something yourself</a></section>

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

  {:else if path === '/account'}
    <section class="page-opening account-opening wall-section"><p class="eyebrow">A place for your paint-covered people.</p><h1>Your corner<br/><em>of the studio.</em></h1><p class="lead">Make yourself at home. Find your friends. Put something playful on the calendar.</p>{#await import('../account/AccountStudio.svelte')}<p>Opening your studio…</p>{:then { default: AccountStudio }}<AccountStudio />{/await}</section>

  {:else if path === '/privacy' || path === '/terms'}
    <article class="legal-page wall-section"><p class="eyebrow">The studio noticeboard · Updated October 29, 2026</p><h1>{path === '/privacy' ? 'Privacy, in' : 'A few studio'}<br/><em>{path === '/privacy' ? 'plain language.' : 'ground rules.'}</em></h1>
    {#if path === '/privacy'}
      <p class="lead">The public preview is for trying things. Your painting isn’t being watched, uploaded or added to a public gallery.</p>
      <h2>What stays here</h2><p>The public paint table keeps marks in your current browser tab’s memory. It does not save them to your account or upload them. Leaving or reloading the page clears them. Example gallery playback is sample artwork, not another person’s private session.</p>
      <p>Your light or dark appearance choice is saved in this browser so it stays the same when you return. It is not sent to an account or used for tracking.</p>
      <h2>No call recording. No advertising trackers.</h2><p>We do not record, store or analyze anyone’s camera video or microphone audio. This preview has no advertising trackers or application analytics. The future art replay feature records artwork operations, not your call.</p>
      <h2>Hosting and basic requests</h2><p>Loading the site sends ordinary web requests, including an IP address, to the hosting provider. The planned public host is Vercel; its service may keep operational logs. Fonts and site images are served with the website. Interactive 360° viewing uses your device’s graphics capabilities and does not request camera or microphone access.</p>
      <h2>If you choose to sign in</h2><p>When account sign-in is configured, Clerk handles email verification and optional Discord sign-in. Signing in sends the information needed for that flow to Clerk and, if you choose it, Discord. We do not need your Discord messages or server membership. When the account server is enabled, it stores your profile and avatar choices, saved layouts, friend requests and connections, party plans and RSVPs under your verified account identifier. Profiles are private by default. A shared profile link is visible to signed-in visitors when you enable it; friends and people you request can see your profile. Your email address is not displayed on profiles or guest lists.</p>
      <h2>Invitations and reminders</h2><p>Account invitations appear in your studio. Shared invitation links reveal the party details, not the guest list; the host can replace or cancel them. Manual email invitations open your own email app. When Resend delivery is enabled, only connected friends who have opted into email invitations and people who have opted into reminders for parties they host or accept are emailed. The server gets your verified primary email from Clerk for delivery; it is not copied into profile cards. Turn either preference off in your profile. A calendar download includes an optional 15-minute reminder handled by your calendar after import. Calendar entries need updating if a party changes.</p><h2>Account launch status</h2><p>Account services and email delivery are not enabled on this public preview yet. Unsigned profile and avatar previews stay in this tab. Before hosted account history and artwork launch, we will publish retention and deletion choices and verify account isolation and delivery.</p>
      <h2>Optional support and contact</h2><p>Support links take you to Cash App, Venmo or PayPal. We do not embed a checkout, track payment clicks or receive your payment details through this website. Copy buttons only put the displayed public handle on your clipboard when you ask. The contact form opens on tapps.design; information you choose to submit there is handled on that site.</p>
      <h2>Party artwork and sharing</h2><p>Hosted party rooms, durable artwork history and account galleries are not enabled in this public preview. Before those launch, this notice will describe retention, deletion, party access and sharing choices. Artwork will not quietly become a public gallery entry.</p>
      <h2>Questions or data requests</h2><p>For privacy questions or account-data requests, <a href={site.contactUrl} rel="noopener noreferrer">contact Tapps using the contact form</a>.</p>
      <p><a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer">Vercel privacy policy</a> · <a href="https://clerk.com/legal/privacy" rel="noopener noreferrer">Clerk privacy policy</a> · <a href="https://discord.com/privacy" rel="noopener noreferrer">Discord privacy policy</a></p>
    {:else}
      <p class="lead">Be kind. Make room for other people. Leave a little space for the weird idea.</p>
      <h2>This is a public preview</h2><p>Pass the Canvas is an independent project in active development. Tools and pages may change, stop working or be reset. The public paint preview is temporary and does not save your work. Do not use it as the only copy of anything important.</p>
      <h2>Your work is yours</h2><p>Trying the paint table does not transfer ownership of your artwork to us. Don’t use the service to violate someone else’s rights. Future shared-art publishing and export features will have clear contribution and sharing choices before launch.</p>
      <h2>Make it a place people can enjoy</h2><p>No harassment, hateful content, threats, impersonation or attempts to interfere with the service. Respect privacy and consent. Nobody owes the group a camera feed, personal details or a particular level of artistic skill.</p>
      <h2>Examples and availability</h2><p>The gallery currently contains illustrative studio examples. It is not a record of real customer parties. Descriptions of planned party and replay features explain the intended experience, not a promise that those features are available now.</p>
      <h2>Accounts and donations</h2><p>If enabled, sign-in is handled by the displayed account provider. Support is optional: Cash App, Venmo and PayPal links open their own services, where you choose an amount. This website does not process payments or store payment details. The payment provider’s terms and privacy policy apply there.</p>
      <h2>Contact and updates</h2><p>Questions? <a href={site.contactUrl} rel="noopener noreferrer">Get in touch with Tapps</a>.</p><p>These are the current preview’s studio rules. Additional terms will be presented before enabling paid features or hosted party-art storage.</p>
    {/if}
    </article>
  {/if}
  </main>

  <footer class="site-footer wood-section"><div><a href="/" class="footer-title">Pass the Canvas<span class="handwritten">Make something. Together.</span></a><p>An art party for all of us.<br/>Especially the “I’m not an artist” ones.</p></div><nav aria-label="Footer navigation"><a href="/how-it-works">How it works</a><a href="/gallery">Gallery</a><a href="/roadmap">Roadmap</a><a href="/support">Donate to the developer</a><a href="/account">Your studio</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href={site.contactUrl} rel="noopener noreferrer">Contact</a></nav><p class="footer-colophon">Made by Tapps. Still a little paint-covered.<br/>Public preview · {new Date().getFullYear()}</p></footer>
  <dialog class="studio-dialog" aria-labelledby="public-room-title" bind:this={roomDialog} onclose={() => roomOpen = false}><div class="dialog-heading"><h2 id="public-room-title">Around the studio</h2><button type="button" onclick={closeRoom} aria-label="Close studio preview">Close <span aria-hidden="true">×</span></button></div>{#if roomOpen}{#await import('./PublicStudio.svelte')}<p class="loading-note">Opening the studio…</p>{:then { default: PublicStudio }}<PublicStudio />{/await}{/if}</dialog>
</div>
