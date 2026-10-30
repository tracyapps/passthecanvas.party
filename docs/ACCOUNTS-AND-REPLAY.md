# Accounts, saved workspaces, and painting replay

Research and implementation plan, checked 29 October 2026. The owner subsequently approved **Clerk email codes + optional Discord, Railway Postgres, and one chosen starting canvas per guest passed around a ring**. Initial account/settings code is now wired behind environment configuration; no external project was provisioned and no credentials were created. This does not make the painting study a networked party canvas.

### Initial wiring status

- `apps/web/src/lib/account/account.svelte.ts`: one lazily loaded Clerk browser client, reactive verified session identity, explicit authenticated workspace load/save functions. `AccountControls.svelte` provides sign-in/create-account and sign-out, or explains that accounts are not configured. Email/Discord options come from the actual Clerk instance settings.
- `apps/server/src/accounts.ts`: authenticated `GET`/`PUT /api/account/workspaces`, Clerk session signature verification with allowed origins, strict bounded workspace validation and per-verified-user Postgres storage. It creates `account_workspaces` on first authenticated use; the runtime database role needs that initial table-creation permission. There is no file/local-memory fallback when account storage fails.
- `.env.example` files document `VITE_CLERK_PUBLISHABLE_KEY`, optional `VITE_ACCOUNT_API_URL`, server-only `CLERK_SECRET_KEY`/`DATABASE_URL`, and exact `ACCOUNT_ALLOWED_ORIGINS`. No values were supplied. Railway deployment, hosted login, Discord production credentials and real Postgres round trips still require configuration and owner-session verification.
- This first storage record holds the complete versioned workspace collection per account. The finer-grained/revisioned tables below remain a future extension; the first account save or successful account load enables debounced current-arrangement saving. Named preset updates stay explicit; revision/conflict protection between active devices remains future work. No party identity, membership, snapshot privacy or journal endpoint was changed by this account-settings slice.

## Recommended next steps

Start the **local replay event contract now**, before promoting the experimental brushes or variable canvas dimensions into the party. Account-owned workspace wiring is now included after provider approval; hosted verification remains pending. Playback UI and movie export can follow durable event capture; they do not need to delay it.

The proposed stack is **Clerk for identity, Railway for the existing Node/WebSocket server, and ordinary Postgres for app records**. Prefer Railway Postgres for a new database to keep hosting together; an existing Neon Postgres database is also a reasonable choice. Do not run two databases or two identity systems. Keep LiveKit for the call.

Use **email verification codes and optional Discord sign-in**, alongside party guests. Joining a church party must not require a Discord account, joining a Discord server, or creating an app account. An account is useful for private saved workspaces and returning to personal settings.

Clerk documents both email codes and Discord login. Its plain JavaScript SDK works with Vite; use that from Svelte rather than introducing React or assuming a SvelteKit adapter fits this Svelte/Vite app. Production Discord login requires an owned Discord developer application and configured credentials. [Email methods](https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options), [Discord connection](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/discord), [JavaScript/Vite integration](https://clerk.com/docs/js-frontend/getting-started/quickstart).

Railway supports long-lived WebSockets and provides Postgres plus persistent volumes and object storage. This fits the existing long-running Node server without changing its basic transport. Hosting alone does not make in-memory parties durable. [WebSocket limits](https://docs.railway.com/networking/public-networking/specs-and-limits), [Postgres](https://docs.railway.com/databases/postgresql), [Storage options](https://docs.railway.com/data-storage).

Neon Postgres and Neon authentication are distinct choices. Neon's current managed authentication is based on Better Auth, but its documented social providers are Google, GitHub and Vercel. Its framework roadmap lists React/Next.js/TanStack support and says separate frontend/backend deployments are not yet supported. Discord support in upstream Better Auth is not evidence that Neon's managed product supports it. These constraints make Clerk the clearer match here today; revisit if the managed product changes. [Neon Auth overview](https://neon.com/docs/auth/overview), [OAuth configuration](https://neon.com/docs/auth/guides/setup-oauth), [Supported architectures and providers](https://neon.com/docs/auth/roadmap).

This is a fit recommendation, not a price comparison or a guarantee about an existing account's plan. Before enabling production, review the chosen plans against expected guests, email delivery, database and snapshot/replay storage, transfer, backups and retention. No provider fees are estimated here.

## What exists today

These are source observations, not claims that the hosted system has been tested:

| Source | Current behavior | Consequence |
| --- | --- | --- |
| `packages/shared/src/protocol.ts` | Fixed 1600×1200 party canvas; strokes contain tool, color, size, flow, optional viscosity, points and a final-batch flag | No canvas ID, geometry version, timing, batch sequence, material load, intensity or contribution identity |
| `apps/server/src/party.ts` | Creates a new member UUID for every join; checks active painter; relays sanitized strokes; holds parties in a process map | Reconnecting does not restore durable painter ownership; stroke history is not stored |
| `apps/server/src/party.ts` | Writes round PNG snapshots to local `data/snapshots` | A snapshot cannot reconstruct the sequence or editable owned contributions; deployed disk needs an explicit persistence strategy |
| `apps/server/src/index.ts` | LiveKit token endpoint accepts caller-supplied party/name/identity; snapshot route serves matching filenames | Account work must also authorize party membership and snapshot access; login UI alone is insufficient |
| `apps/web/src/lib/party/connection.svelte.ts` | Hands remote strokes to the canvas without preserving the message's `painterId` in the callback | Ownership metadata must reach the layered renderer |
| `apps/web/src/lib/canvas/StudyCanvas.svelte` | Separate local study; freezes settings per stroke, uses owned transparent layers, distance-spaced stamps and timed stationary airbrush emission | The richer behavior is not represented by the old party protocol; simply saving existing messages would lose it |

The party server currently ends the turn when the timer reaches zero. That is separate from the owner's preferred gentle timer behavior and needs its own party-loop change; a replay journal must record the actual accepted pass boundary rather than infer it from a countdown.

## Saved workspaces: display state and account state

Implement local saves first without presenting them as account-backed. Use a versioned record with a named preset, tool arrangement/visibility/order, layout choice, panel dock positions and applicable viewport settings. Remember the last selected preset and working arrangement on this browser. Handle unavailable or full browser storage with honest feedback and a usable default.

For account-backed saves, proposed app records are:

- `users`: internal user ID and unique verified identity-provider subject. Keep contact details with the identity provider unless the app needs them.
- `workspace_presets`: ID, owner user ID, name, schema version, revision, configuration, created/updated timestamps.
- `workspace_preferences`: user ID, display profile, last selected preset ID, last working arrangement and revision.

A named preset is reusable intent, not a frozen screen capture. Store normalized positions and each supply's existing working-end visibility rules; reapply bounds and canvas exclusion rules when loading into a different display. Keep desktop, portrait/tablet and phone adaptations independent so a phone visit does not overwrite a carefully arranged desktop. Panel and viewport changes stay private to that display; they never change someone else's canvas.

Provide Save as, Update saved view, Rename, Duplicate, Delete, and Restore saved arrangement. Distinguish unsaved adjustments from the saved preset. Restore the last working view on return, with the named preset still selectable. Use revisions for conflict detection rather than silently overwriting edits from another active device.

Signing in should offer **Copy this browser's saved views to my account**. Do not silently import another guest's browser-local work into whoever signs in next. Keep the local source until the user chooses to remove it. Signing out clears account-backed cached settings from the session; shared browsers must not show another account's private views. Do not store session tokens in layout records.

## Identity and authorization

Use an internal stable contributor ID distinct from a socket connection, display name, and account-provider ID. Server-issued guest credentials can resume a guest contribution; account authentication can resume an account contributor. A name or client-supplied painter ID must never establish ownership.

The server verifies account sessions, then authorizes each preset, party, contribution and replay request. Clerk's backend API documents token verification and an allowed-origin list. Also enforce party access independently of login. [Backend request verification](https://clerk.com/docs/reference/backend/authenticate-request).

Browser WebSockets cannot supply arbitrary Authorization headers. A proposed handshake is an authenticated HTTPS request for a short-lived, single-use party ticket, followed by ticket verification on WebSocket join. Require appropriate origin validation, expiration, replay prevention and reauthorization on reconnect. Do not put long-lived account credentials in socket URLs or logs. Guest tickets use the same party authorization boundary.

Discord is an optional identity connection. Request only the identity information required by the configured sign-in flow. Do not request guild lists, server membership, messages, bot permissions, or voice access. Allow intentional account linking through the provider's verified flow; do not merge accounts by display name. Discord's OAuth scopes distinguish basic identification from guild, message and voice permissions. [Discord OAuth scopes](https://docs.discord.com/developers/topics/oauth2).

## Replay event contract

The server accepts and orders art events; the client records input in artwork coordinates. Save accepted art operations, not screen recordings. The following is a proposed schema to design and test before changing `packages/shared`:

| Record | Required content |
| --- | --- |
| Canvas creation | `canvasId`, logical width/height, surface/background, schema version, renderer version |
| Contribution start | Stable contribution ID, canvas ID, server-verified contributor, turn ID, layer order |
| Stroke start | Stroke ID, contribution ID, tool, medium, full paint load including ordered multicolor swatch, size, intensity/flow, wetness, brush parameters, deterministic seed |
| Stroke batches | Stroke ID, batch sequence, artwork points with pressure and relative time, monotonic event sequence and elapsed painting time |
| Emitted marks | Stamp index and angle plus timed stationary emissions, or sufficient fixed-step input to regenerate them exactly |
| Stroke completion | Completed/cancelled state, last acknowledged batch; cancelled gestures must not become permanent marks |
| Art operations | Undo/redo with target operation IDs, contribution visibility if supported, explicit destructive art changes, pass boundaries |
| Checkpoints | Canvas ID, last committed event sequence, renderer version, dimensions, ordered owned layer images and integrity metadata |

Choose one canonical way to reproduce stamps. Recording emitted marks is the easiest first correctness target for this study: a stationary airbrush emits every 40ms today even with no pointer movement. Replaying only pointer points loses that paint. Preserve global stamp indexes across network batches; use recorded seeds/indexes rather than fresh randomness or receiver frame rate. Freeze all settings at stroke start and preserve swatch order. Timed playback may accelerate elapsed time but must not change the number or order of marks.

Water, sponge, eraser and burnisher must sample and change **only their contributor's transparent layers**, in their original composite order. Never replay modifiers against the flattened checkpoint containing other artists. Undo may require rebuilding the affected contribution from an earlier owned-layer checkpoint because smudging and burnishing depend on pixels that existed at that moment. Keep renderer versions executable or retain compatible checkpoint migrations; a changed brush algorithm must not silently repaint old art differently.

View rotation is a local camera transform: inverse-transform pointer coordinates back into stable artwork coordinates, including nonsquare canvases. Panning, zooming, resizing the viewing frame and rotating for a comfortable painting angle do not mutate shared artwork dimensions and should not be art events. A separate destructive rotate-art action, if ever wanted, would require an explicit shared operation.

The server assigns identity, authorization and order. Deduplicate by canvas/stroke/batch ID, validate finite bounded coordinates/pressure/settings, and reject unauthorized contributions. Acknowledge only durably committed events; pending local marks remain visibly pending and are retried idempotently. On reconnect request everything after the last acknowledged sequence, including enough contribution checkpoints to preserve modifier ownership. Define behavior for strokes interrupted by a pass or disconnect instead of inventing completion on replay.

Use bounded batched records in Postgres initially, with event metadata and versioned payloads. Store larger layer snapshots and exports in private object storage. Do not add Redis, queues or a second database before actual scale requires them. Keep a short browser-side pending queue for connection recovery, with explicit failure/expiry behavior rather than claiming an unsaved stroke is safe.

## Canvas selection and passing topology

Each physical canvas has immutable logical dimensions chosen before painting. Its owner may choose landscape, portrait, square or another offered ratio. Everybody receiving that same canvas receives those dimensions; a viewer can rotate or fit it locally without cropping or stretching the artwork.

There are two distinct game models. The existing server has **one shared canvas and one active painter**. The owner confirmed the new format: **one chosen starting canvas per participant, with canvases passed around a ring**. The existing server still needs that implementation; local study canvas choices do not establish that the networked party already supports it.

Before networking variable dimensions, settle whether painters work simultaneously, which canvas passes to whom, how late join/disconnect works, who can advance a gentle timer, and what the reveal contains. Both formats need explicit `canvasId` and server-authoritative assignments. The local setup screen can explore shapes immediately without claiming the party already supports multiple canvases.

## Delivery order and evidence gates

1. Finish the local workspace and canvas-frame experiments. Prove named local saves survive reload; small screens move supplies in the intended visual direction; rotated input stays aligned.
2. Add a renderer-neutral local journal adapter and replay test harness. Compare direct render with replay for multicolor paint, intensity, held airbrush, wet modifiers, burnishing, cancellation, undo and rotated nonsquare surfaces. Require ownership preservation. Browser raster differences need tolerances; do not promise byte-identical pixels across browsers.
3. Provider/database choice and ring topology are approved. For party integration, update shared types first, both apps together, and add durable contributor ownership and canvas assignments. Do not expose this until two real sessions prove unauthorized saves/strokes are rejected.
4. Add account-backed preset CRUD and explicit local import. Verify account switching, expiry, server failure, conflicts and cross-device restore on a real database.
5. Capture durable accepted events, checkpoints, reconnect and restart recovery. Verify a party survives server restart without losing acknowledged art. Then add replay player, scrubbing and time-lapse export.
6. Add private account albums only with a clear party-art ownership/sharing policy. Add the public introduction/site and optional **Donate to the developer** link later; select the donation provider then. No checkout or donation dependency is needed now.

Accessibility gates cover keyboard and touch alternatives, announcements for save/error states and paused/scrubbable replay with reduced motion. Physical pen/touch, Safari and actual hosted persistence need their own evidence; unit tests cannot establish them.

## Privacy and approval boundary

The owner's request authorizes planning art-stroke replay; it does not authorize recording calls. Audio and video remain exclusively in LiveKit with recording off. Replay contains art operations only: no camera frames, microphone audio, chat, radio, profile photos, screen capture or interaction analytics. Keep art and replays party-private by default, protect download access, set a retention/deletion policy, and let users deliberately export. Account deletion and shared-art attribution need a stated policy that protects other contributors' work without retaining unnecessary identity data.

`AGENTS.md` currently says only party canvas snapshots are saved. Before durable replay ships, update that documentation and the user-facing notice to include art-event history, retention and deletion. Storing strokes must not quietly broaden into recording people's sessions.

`AGENTS.md` explicitly requires asking before **“new dependency, new service, changing the protocol or folder layout.”** The owner approved Clerk + Railway Postgres and account-settings wiring, so their SDK/database dependencies and local modules are now installed. External service provisioning/deployment is not performed by this slice. The versioned party art-event protocol remains to be implemented with shared-types and both apps updated together. No external resources or credentials were created.

## Local configuration and acceptance handoff

1. Create/configure the Clerk application with email verification codes and optional
   Discord. Put the publishable key in `apps/web/.env.local` and the secret key
   in `apps/server/.env`; use the adjacent example files. Never paste secrets
   into workspace layouts or commit them.
2. Set server `DATABASE_URL` to the Railway Postgres connection URL and
   `ACCOUNT_ALLOWED_ORIGINS` to the exact frontend origins (including the active
   local port). Restart both processes after environment changes. The initial
   verified request needs permission to create `account_workspaces`.
3. Open Menu, sign in, then Arrange → Saved views. Explicitly copy browser views
   if desired. Save a named account view, reload and restore it in a second
   signed-in browser. Verify sign-out and another account cannot see it.
4. Stop database access and confirm a visible save error; no successful cloud-save
   message may appear. Test expired sessions, origin rejection and simultaneous
   devices before relying on this for party use. Last-write-wins is the current
   account collection policy; revision conflict resolution remains open.

Local tests exercise verified-subject isolation, origin/session rejection, bounded
input and storage failure. They do not establish live Clerk, Discord or Postgres
readiness. No external project was provisioned in this change.

## October 30 account-community extension

Profiles, original local avatar badges, mutual friendship, scheduled parties,
account invitations, revocable share links, RSVP/calendar export and an approved
Resend opt-in outbox are now implemented locally. See `ACCOUNT-COMMUNITY.md` for
exact source/API/configuration and hosted acceptance checks. The real local
Postgres integration suite is exercised; no live Clerk/Discord or email delivery
is claimed. Railway inspection requires connector reauthentication. No party
WebSocket message changed, and completed art/attendance/replay history remains
behind the durable verified-party integration described above.
