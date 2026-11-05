<!--
  Privacy and Terms, in plain language. Keep these true: when a feature
  changes what's stored or who sees it, update the page and the date.
-->
<script lang="ts">
  import { site } from './public-site-content';
  let { page }: { page: 'privacy' | 'terms' } = $props();
  const updated = 'November 5, 2026';
</script>

<article class="legal-page wall-section">
  <p class="eyebrow">The studio noticeboard · Updated {updated}</p>
  {#if page === 'privacy'}
    <h1>Privacy, in<br /><em>plain language.</em></h1>
    <p class="lead">Pass the Canvas is a place to make art with friends. It isn’t a business. Nothing here is sold, advertised or tracked.</p>

    <h2>The short version</h2>
    <ul>
      <li>No ads, no advertising trackers, no analytics.</li>
      <li>Your information is never sold, rented or shared for marketing.</li>
      <li>Party video and audio are live only. They are never recorded or stored.</li>
      <li>We keep only what the studio needs to work, and you can ask for all of it to be deleted.</li>
    </ul>

    <h2>Trying it without an account</h2>
    <p>Visitors can try the paints and the avatar maker without signing in. That work stays in your browser and is never uploaded. Your appearance and display choices are also saved in your browser, so they stay the same when you come back.</p>

    <h2>What we keep when you have an account</h2>
    <ul>
      <li><strong>Sign-in:</strong> your email address, checked by our sign-in service. Discord sign-in is optional. We never see your Discord messages or servers.</li>
      <li><strong>Your profile:</strong> your name, short bio, optional photo, initials color and any links you add. Photos are re-saved in your browser before upload, which removes hidden camera details like location.</li>
      <li><strong>What you make:</strong> your avatars, practice pieces and their auto-saves (the newest 20), and your saved table layouts and toolboxes.</li>
      <li><strong>Parties and friends:</strong> parties you plan or join, RSVPs, friend requests and friends.</li>
      <li><strong>Settings:</strong> your privacy, email and display choices.</li>
    </ul>
    <p>Your profile is private unless you turn on profile sharing. Your email address is never shown to other people.</p>

    <h2>Parties</h2>
    <ul>
      <li><strong>Video and audio</strong> travel live between guests through our video service. Nothing is recorded or saved. You can always join with your camera off or as an avatar.</li>
      <li><strong>Party art:</strong> when a party ends, the finished pieces and their time-lapse are saved as a gallery. The gallery isn’t listed anywhere public: anyone with its link can view it, so share the link with care. The host gets a private link to delete it.</li>
      <li><strong>Invite links</strong> show the party details, not the guest list. The host can replace or cancel them.</li>
      <li><strong>Party radio:</strong> if you turn it on, your browser connects straight to the radio station.</li>
    </ul>

    <h2>Email</h2>
    <p>We only email you about parties: invitations from friends and reminders, and only if you’ve turned those on. You can turn them off in Settings. Your calendar feed link is private to you, and you can replace it any time.</p>

    <h2>Services that help run the studio</h2>
    <p>These services handle only what they need to do their job. Like any website, they may keep basic logs, such as your IP address.</p>
    <ul>
      <li><a href="https://vercel.com/legal/privacy-policy" rel="noopener noreferrer">Vercel</a>: hosts the website.</li>
      <li><a href="https://railway.com/legal/privacy" rel="noopener noreferrer">Railway</a>: runs the studio server and database.</li>
      <li><a href="https://clerk.com/legal/privacy" rel="noopener noreferrer">Clerk</a>: sign-in and email verification.</li>
      <li><a href="https://livekit.io/legal/privacy-policy" rel="noopener noreferrer">LiveKit</a>: live party video and audio.</li>
      <li><a href="https://resend.com/legal/privacy-policy" rel="noopener noreferrer">Resend</a>: party invitation and reminder emails.</li>
      <li><a href="https://discord.com/privacy" rel="noopener noreferrer">Discord</a>: only if you choose Discord sign-in.</li>
    </ul>
    <p>Donation links open Cash App, Venmo or PayPal. This site never sees your payment details.</p>

    <h2>Your choices</h2>
    <ul>
      <li>Edit or delete your profile, avatars, practice pieces and saved galleries in your studio at any time.</li>
      <li>To get a copy of your data, or to delete your account and everything in it, <a href={site.contactUrl} rel="noopener noreferrer">contact Tapps</a>. Your request will be handled within 30 days. Self-serve buttons for both are coming.</li>
    </ul>

    <h2>Age</h2>
    <p>Accounts are for people 13 and older. If you think a child under 13 has made an account, <a href={site.contactUrl} rel="noopener noreferrer">let Tapps know</a> and it will be deleted.</p>

    <h2>Changes and questions</h2>
    <p>If something here changes, this page and its date will be updated. Big changes will also be announced in your studio. For questions, <a href={site.contactUrl} rel="noopener noreferrer">get in touch with Tapps</a>.</p>
  {:else}
    <h1>A few studio<br /><em>ground rules.</em></h1>
    <p class="lead">Be kind. Make room for other people. Leave a little space for the weird idea.</p>

    <h2>The short version</h2>
    <p>Pass the Canvas is free, made by one person, and here so people can enjoy making art together. By using it, you agree to these rules and to the <a href="/privacy">privacy notice</a>.</p>

    <h2>Who can use it</h2>
    <p>You need to be 13 or older to make an account. If you’re under 18, check with a parent or guardian first. Keep your sign-in to yourself, and you’re responsible for what happens on your account.</p>

    <h2>Your art is yours</h2>
    <ul>
      <li>You own what you make here. We don’t claim it.</li>
      <li>You let the studio store your work and show it to the people you’re sharing it with. That’s the only reason we need it.</li>
      <li>Party pieces are made together. Everyone who painted on a piece can keep and share it for fun. For anything beyond that, ask the others first.</li>
      <li>Only upload photos and images you have the right to use.</li>
    </ul>

    <h2>Make it a place people can enjoy</h2>
    <ul>
      <li>No harassment, hate, threats or impersonation.</li>
      <li>Nothing sexual, violent or cruel, especially anything involving a minor.</li>
      <li>Respect privacy and consent. Don’t record other people or share their details or art without permission.</li>
      <li>Nobody owes the group a camera feed, personal details or any particular level of skill.</li>
    </ul>

    <h2>Don’t break the studio</h2>
    <p>No spam, bots, scraping, attacks, or attempts to get into accounts or parts of the service that aren’t yours.</p>

    <h2>A small, independent project</h2>
    <p>The studio is offered as it is, without guarantees. Features may change, break or go away. Download a copy of anything important. To the extent the law allows, Tapps isn’t responsible for lost work or other losses from using the studio.</p>

    <h2>Ending things</h2>
    <p>You can stop using the studio and ask for your account to be deleted at any time. If someone breaks these rules, their content or account may be removed.</p>

    <h2>Donations</h2>
    <p>Donations are optional. They don’t buy anything or change what you can do here. Cash App, Venmo and PayPal’s own terms apply when you use them.</p>

    <h2>Changes and questions</h2>
    <p>If these rules change, this page and its date will be updated. For questions, or to report a problem or a person, <a href={site.contactUrl} rel="noopener noreferrer">get in touch with Tapps</a>.</p>
  {/if}
</article>

<style>
  ul { padding-left: 1.2em; }
  li { margin: 0 0 .6em; }
  /* Links here sit inside sentences (exempt from the 44px target size), so they shouldn't push lines apart. */
  article.legal-page a { display: inline; min-height: 0; }
</style>
