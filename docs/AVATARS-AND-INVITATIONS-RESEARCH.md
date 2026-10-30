# Avatars, invitations, and reminders

Research checked **30 October 2026**. This is a design and implementation recommendation, not evidence of a provisioned provider or a working hosted mail flow. No dependencies, services, credentials, messages, or avatar assets were added by this research.

## Recommended avatar direction

Start with an **original, local illustrated avatar builder**: choose a face or playful studio creature, colors, hair, accessories, and a paper/pin frame. Render the same avatar in the party seat, profile, attendee list, and recap. A colorful paper cutout or small painted portrait belongs naturally in the photoreal room without requiring a second real-time 3D engine. This is a product recommendation rather than a provider claim.

Keep an initials/abstract badge available immediately, including for guests and when media permissions are denied. Avatar participation must never require a webcam, microphone, selfie, face recognition, a Discord account, or a paid service. A user may voluntarily join audio while using an avatar; that does not imply permission to record or analyze audio. All customization must have named keyboard-operable controls, not a drag-only editor.

| Option | What it buys us | Limits and decision |
| --- | --- | --- |
| Original SVG/illustrated builder | Exact studio style; local rendering; compact versioned settings; no outside avatar request | Requires original commissioned/owner-created artwork. Build a small inclusive selection well before expanding; do not copy a proprietary character kit. Recommended first version. |
| DiceBear, generated locally | Existing customizable SVG styles; avoids a hosted avatar dependency | Its engine and artwork have different licenses. Pin engine/style versions and preserve credits. Good optional shortcut after dependency and asset approval. |
| Uploaded illustration/photo | Lets a person use artwork or a portrait they already own | Needs secure image processing, private storage, deletion, reporting, and explicit visibility controls. Defer until storage is ready; no arbitrary SVG upload. |
| VRM model import / VRoid-authored character | User-owned stylized 3D identity without mandatory face tracking | Larger downloads, mobile GPU cost, model validation and per-model rights. Useful later; do not embed VRoid assets in our own customizable builder without the required license. |
| MetaPerson / Avatar SDK | Commercial hosted or local-compute avatar pipeline | New paid provider and image-processing privacy surface; not needed for the first-party no-photo option. Consider only for an optional later feature. |

### DiceBear: license the artwork, not just the engine

DiceBear explicitly distinguishes MIT-licensed software from artist-selected style licenses. Its license index currently lists **Open Peeps, Shapes, Thumbs, and Lorelei** among CC0 styles; keep an exact license copy with any selected version instead of assuming the whole catalog is interchangeable. [DiceBear license index](https://www.dicebear.com/licenses/).

**Open Peeps**, by Pablo Stanley, is hand-drawn, modular, and CC0; it is the strongest ready-made fit for a playful studio. Its documented JavaScript path supports local SVG generation. Lazy-load only an approved selected style; use an opaque random seed rather than an email or account ID, and save the versioned settings so updates do not unexpectedly change a person's appearance. [Open Peeps style, license, and local usage](https://www.dicebear.com/styles/open-peeps/).

**Adventurer**, by Lisa Wischofsky, uses **CC BY 4.0**, so it needs attribution and appropriate change/license notices. **Bottts**, by Pablo Stanley, is marked with its own **free personal and commercial use** terms, not MIT or automatically CC0. Neither is the simplest licensing default. [Adventurer](https://www.dicebear.com/styles/adventurer/), [Bottts](https://www.dicebear.com/styles/bottts/). DiceBear also offers a self-hostable HTTP API, but browser-local generation avoids running another service for this use case. [DiceBear project support and repositories](https://www.dicebear.com/support/).

### Current 3D options and availability boundaries

**VRoid Studio / VRM:** the first-party product supports exporting characters as VRM. Its guidelines allow many commercial uses of exported models, subject to special asset clauses; they explicitly require a separate pixiv license for a third-party character creation app that generates models from combined/deformed VRoid meshes and textures. Therefore “let users import their permitted finished model” and “build our own editor out of their assets” are different proposals. Store the model's creator/license conditions and enforce them; a file extension is not a license. [VRoid Studio](https://vroid.com/en/studio), [VRoid guidelines](https://vroid.com/en/studio/guidelines).

**MetaPerson / Avatar SDK:** the provider currently advertises customizable 3D characters, pre-made starting avatars, and standard model export. Its current pricing lists Pro at **$800/month** with creator integration, while some creator marketing copy describes integration as Enterprise. Obtain written confirmation of the applicable integration plan and image-retention terms before selecting it. This cost and commercial ambiguity make it a poor first choice for the church-party launch. [Creator capabilities](https://avatarsdk.com/metaperson-creator/), [current provider pricing](https://avatarsdk.com/pricing-cloud/). This is not an approved expense.

**Ready Player Me:** do not choose it based on older integration tutorials. Direct checks of its [official website](https://readyplayer.me/) and [official documentation](https://docs.readyplayer.me/) failed with 502 responses during this research; the [official GitHub organization](https://github.com/readyplayerme) still exists, but that is not proof of a functioning hosted creator/API. A first-party shutdown notice could not be recovered, so this note does **not** assert a verified shutdown date. Availability and support are unverified; exclude it from the implementation shortlist until the operator can establish an active supported service. This explicit uncertainty matters more than an old SDK being downloadable.

### Proposed storage and privacy rules

Store a bounded descriptor, not arbitrary executable markup: `kind`, renderer/art version, approved option IDs, colors, and random seed. Generate trusted SVG from allowlisted components. Never interpolate profile names into raw SVG/HTML. Keep avatar identity separate from authentication provider identity; signing in with Discord must not silently make a Discord photo public.

For optional image uploads later: validate the actual decoded raster, enforce size/pixel limits, re-encode and strip metadata, use random storage keys, serve controlled derivatives, and let owners replace/delete them. Do not fetch arbitrary remote avatar URLs from the backend. Default profile/painting visibility should remain private or party-scoped; recap attendance must not become a public directory automatically. These are proposed app requirements, not promises about current storage.

## Invitations and reminders

Keep three distinct actions: **copy a party link**, **invite an existing site account**, and **send email**. A copied link works before a mail service is selected. In-app notifications can be durable database records without an external mail dependency. Friend acceptance and party RSVP are separate states; adding a friend should never subscribe them to every host's reminders.

| Provider | Verified capabilities / restrictions | Fit |
| --- | --- | --- |
| Resend | API supports scheduling up to **30 days** ahead, rescheduling and cancellation. Its AUP requires recipients to have opted in and prohibits unsolicited messages. | Convenient API and short-term scheduled reminders. Does not justify unrestricted mail to arbitrary addresses. |
| Postmark | Transactional streams are for individual messages the recipient expects; bulk traffic belongs in broadcast streams. **No native delayed sending**; our server must schedule the API request. Its terms require permission-based lists. | Strong transactional alternative when scheduling stays in our database/worker. Same need to establish recipient permission. |

[Resend scheduling](https://resend.com/docs/dashboard/emails/schedule-email), [Resend acceptable use, updated 13 October 2026](https://resend.com/legal/acceptable-use), [Postmark transactional definition](https://postmarkapp.com/support/article/804-what-are-transactional-emails), [Postmark scheduling limitation](https://postmarkapp.com/support/article/1118-can-you-schedule-emails-with-postmark), [Postmark terms](https://postmarkapp.com/terms-of-service).

Recommendation: keep provider-neutral records in the approved Railway Postgres backend, and provision **neither provider yet**. Resend is a reasonable first candidate for approved, expected mail; Postmark remains a good alternative. For nonmembers, ship copy-link/manual sharing first. Before enabling app-sent invitations to new email addresses, confirm the precise expected friend-invite flow with the selected provider and implement permission/abuse handling. This is a provider-policy compatibility boundary, not a claim that all personal invitations are unlawful.

### Delivery design to implement after service selection

- Save party start as an absolute instant plus its IANA time zone; display local time and provide a calendar file. Recalculate due reminders when the host changes or cancels the party.
- Store RSVP, per-user reminder opt-in, delivery preference, and a versioned outbox job. Claim due jobs transactionally; recheck membership, party version, RSVP, cancellation and suppression before sending. Never depend on an open browser timer.
- Use a unique logical delivery key such as party/version/recipient/reminder kind; preserve provider IDs and bounded retries. Resend's documented idempotency retention is **24 hours**, so app-side deduplication is still needed. [Resend idempotency keys](https://resend.com/changelog/idempotency-keys).
- Use expiring, revocable invitation tokens, store only token hashes, and avoid revealing private attendee emails or whether an unrelated email has an account. Require verified senders, rate limits, block/report actions, recipient suppression and bounce/complaint handling.
- Keep mail free of tracking pixels and click rewriting unless a future explicit tracking decision permits them. A provider accepting a message is not proof it reached the inbox; show queued/sent/failed accurately.
- Link friend actions from the live attendee list and private recap. Recap artwork/room imagery should contain art and approved avatar representations, never a recording or saved webcam tile. Link to only paintings the visitor is authorized to see.

## Approval and verification gates

The previously approved services remain Clerk email + optional Discord and Railway Postgres. Adding DiceBear packages, commercial avatar software, an upload-storage service, or a mail provider requires owner approval under `AGENTS.md`. No new service is necessary for a small original local SVG avatar editor or copyable invite links.

Before production email: provider account/domain authentication, approved sender and invite use case, server-only secret, job runner, opt-in/suppression paths, cancellation/reschedule tests, and real recipient delivery evidence. Before uploaded or 3D avatars: storage and retention review, model/image validation, rights records in `studio/ASSET-CREDITS.md`, deletion tests, mobile performance and keyboard/screen-reader review. The first-party avatar fallback must continue working when every optional provider is unavailable.

## Owner decision and first implementation

Later on October 30, the owner approved **Resend for expected invitations and
opt-in reminders**. The first implementation uses the existing Node service and
Postgres outbox, built-in fetch and Clerk's verified primary email. It accepts no
arbitrary third-party recipient address. Delivery is disabled pending sender,
credentials and delivery/suppression verification; see `ACCOUNT-COMMUNITY.md`.
Original no-photo brush/star/cat/swirl avatar badges are implemented as the first
local preview; richer illustrated characters remain a future design decision.
