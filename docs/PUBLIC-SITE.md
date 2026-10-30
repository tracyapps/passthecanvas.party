# Public studio website — first version

29 October 2026. Tagline: **Make something. Together.** Supporting invitation:
**No masterpiece required.** This is an owner-requested public-site slice alongside
the unfinished party application; it does not mark the multiplayer phase complete.

## Experience

- `/`: a taped-up invitation inside the actual Cream City room, color-changing
  light switch, permission slip, emotional-support trinket Easter egg, passing
  concept, working local paint table and invitation to the gallery.
- `/how-it-works`: six planned stages, from party code to the wall/replay. Each
  participant starts a chosen-size canvas; canvases pass around the circle.
  Video or avatar are equally welcome. Host pacing and gentle timer are planned.
- `/try`: production-safe, tab-local paint preview using the existing mark renderer.
  Brush, colored pencil, eraser, named colors, size, keyboard painting and reversible
  clear. It neither uploads nor stores marks. Private study settings stay private.
- `/gallery`: three original illustrative pieces, asymmetrically hung, with explicit
  Play/Pause/Restart and creation-progress scrubbing. No invented parties or artists.
- `/roadmap`: available / in progress / next / someday, with no invented dates.
- `/support`: maker's story, optional Cash App/Venmo/PayPal choices with copyable
  handles, and the existing public contact form. No embedded checkout.
- `/account`: existing Clerk controls, honest unconfigured state, future album boundary.
- `/privacy`, `/terms`: readable preview notices describing actual data behavior.
  The existing tapps.design contact form is now linked. Complete hosted-party policies
  still need review before party uploads, submissions or account-art storage.

The 360° room is lazy-loaded on explicit request, with drag, keyboard and named
viewpoint buttons. Native dialog close/Escape and a visible image-load error fallback
are included. No automatic rotation, sounds, camera or microphone requests.

## Editable sources

- `apps/web/src/lib/ui/public-site-content.ts`: copy, navigation, verified support provider handles/URLs and
  the public contact-form destination.
- `apps/web/src/lib/ui/public-pages.json`: page titles and descriptions, shared by
  Svelte and the build. `public-pages.mjs` emits nine HTML shells with metadata and
  an original raster social image, plus a 404. This is metadata generation, not SSR.
- `PublicSite.svelte`, `PublicStudio.svelte`, `PublicPaint.svelte`,
  `PublicGallery.svelte` and `apps/web/src/styles/public-site.scss`: presentation
  and interaction. No new runtime dependency or framework.
- `apps/web/public/site`: project-owned/generated assets and local licensed fonts.
  Source/provenance: `studio/ASSET-CREDITS.md`. Supplied pillow photos remain references. The owner has now cleared public use
  of the artist-tool photos; four reviewed WebP derivatives are promoted.

`App.svelte` retains party query links and development studies while making `/`
the public entry. Owner-only editors/studies are gated to development. LiveKit and
party studio code are lazy-loaded so public visitors don't download them up front.
The mark renderer is reused without changing the party protocol or studio study.

## Connect and publish

See [PUBLIC-DEPLOYMENT.md](PUBLIC-DEPLOYMENT.md). This first public site does not
require Clerk/Railway/LiveKit credentials. Root Vercel and Railway configurations
and GitHub checks are ready. The first static artifact is published on Vercel;
Git linking/push and custom-domain/DNS setup remain pending. Configure `VITE_PUBLIC_SITE_URL` for accurate static
link-preview URLs. Custom-domain ownership and social crawler rendering still need
verification on the deployed origin.

Before the first Git-based build, include reviewed earlier account/canvas source
changes that the current app references, not just the public files. Do not stage
all untracked files: unrelated Blender backups, work renders and `_design` sources
must retain their separate review/LFS boundaries. Check the panorama resolves to
real pixels after Vercel LFS checkout; a successful JavaScript build alone cannot
prove the room asset is present.

Hosted multiplayer, actual account/DB saves, replay persistence, private art
retention/deletion and donation processing remain unverified/unavailable in this
public version. Camera/microphone recording remains out of scope.

## First deployment preparation

The owner's connected Vercel team is `tracyapps-projects`. A new project named
`passthecanvas-party` (`prj_ZXyzZKJyDmOAbgQAvGpfFOEgtByd`) was created for the
requested first online preview. This one-time release uploads the locally tested
static build, without source files, credentials, Git commits or DNS changes.
Git linking remains a follow-up after the reviewed source is committed; linking
an older repository state now could replace this preview with the old app.
Initial v1 final deployment: `dpl_7eCX7oBncT9i9B4RYcYWyNiK3hrm`, **READY**, production,
https://passthecanvas-party.vercel.app (29 October 2026, America/Chicago).
The first artifact deployment was `dpl_F3pY5Qv4hGENT9qZ7xw7DQ26jqGb`; the final
one corrects static social metadata to the live alias. This is an artifact from
the reviewed working tree, not a claim that uncommitted source was pushed.

Live evidence: all nine public paths return 200 with matching static titles and
social-image URLs; missing `/api/not-a-route` returns 404. The panorama returns
2,492,002 bytes with a real RIFF/WebP header, not an LFS pointer. Hosted browser
checks cover room viewpoints, keyboard paint, gallery Play/Pause/scrub and zero
console errors in those flows. Current project settings are Vite, Node 22,
repository-root npm ci/build, apps/web/dist and Git LFS enabled. Account providers,
Railway, custom domain and payment processing were not provisioned.

An attempted non-secret `VITE_PUBLIC_SITE_URL` project-variable creation received
Vercel 403 permission denied. No local Vercel CLI credential path was available.
The source default is the current live origin instead, so no environment variable
is required for the initial static release. Set it through the dashboard when
switching to a custom domain.

## Support and photographed tools follow-up

The owner cleared artist-tool photo rights and requested the same support setup as
https://plugins.tapps.design/support/. That page was fetched live and its three
provider URLs/handles and contact link were reused. PublicSupport.svelte provides
manual external payment choices and clipboard success/failure feedback. No transfer
is initiated by the website. Privacy and Terms describe outbound providers and
contact-form use; no payment checkout or financial data collection was added.

The public preview now uses licensed owner-supplied brush, pencil set, eraser and
watercolor tin WebP photographs; the original private study is unchanged.

Latest follow-up deployment: `dpl_9CbprDqk2voQAvybzH2xJXsnnG5d`, **READY**,
production, same public alias. Hosted verification confirms all three exact
provider destinations, no-referrer/new-tab behavior, working clipboard feedback,
no phone-width overflow, real promoted tool images and no browser console errors.
An initial follow-up artifact attempt inherited Git-source `npm ci` settings and
failed before promotion; explicit static artifact settings resolved that. Future
Vite/npm/Git-LFS settings were restored afterward. No payment was sent or tested.

## Appearance and room update (October 30, 2026)

Header appearance button toggles light/dark and remembers the choice on this
browser (`ptc-site-theme-v1`). Light remains the default; no account or network
storage is involved. The early index.html script prevents a light flash between
pages. Paper objects and artwork retain their original colors. Footer wood uses
one covered image with a dark overlay in both themes. The Cream City panorama
now serves the owner's Photoshop texture edit, exported to 4K quality-90 WebP;
its URL and all viewpoint geometry remain the same.

## Hero and type refresh (October 30, 2026)

Public headings now use Days One and handwriting uses Square Peg. Both are
served from `public/site` with their SIL OFL files; private painting-app typography
is unchanged. The hero embeds `PublicStudio` in its `hero` variant behind the
smaller paper invitation. It slowly turns until paused or interacted with. The
small instruction strip offers Pause/Rotate, with arrow-key viewing on focus and
two-finger touch exploration. Single-finger scrolling and mouse-wheel page
scrolling remain available. Reduced-motion preference disables rotation and
inertia; rotation also stops offscreen and in hidden tabs. The static scene
remains a fallback while the viewer loads. The gallery's full room dialog remains.
The old Lights wash and duplicate decorative wall lettering are removed. Actual
room lighting, including lamps, shadows and exposure, is on the public roadmap.

## Viga and account foundation (October 30, 2026)

Viga replaces Days One for public headings; Square Peg remains. `/account` now
contains an unsaved avatar/profile preview until Clerk is configured, and loads
private profile, friend and party-planning controls for an authenticated account
when the account backend is connected. Source/API/delivery boundaries and setup
are in `ACCOUNT-COMMUNITY.md`. Hosted sign-in, mail delivery and completed party
history must not be advertised as available until their acceptance checks pass.
