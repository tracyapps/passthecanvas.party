# Public site: connect and deploy

The public website and local painting preview can run on Vercel before Clerk,
Railway or LiveKit are connected. They do not need a database to build. The
gallery's examples are demonstrations, not a public feed of guests' work.

The current Git-backed production site is **https://passthecanvas.party** in
Vercel team `tracyapps-projects`, project **`web`**
(`prj_DEd59ZRzvLzafcskn5kcI0E5qHjL`). The owner imported/connected this project.
A real Git build of main commit `6f4808d` succeeded on October 30 after correcting
its saved build settings. The older `passthecanvas-party` project and
https://passthecanvas-party.vercel.app remain the earlier static-artifact preview;
do not confuse that project's deployment history with `web`.

## 1. Vercel website

Use the owner's Git-connected **`web`** project for the custom domain. Its build
must start at the repository root so it reads root `vercel.json` and npm workspaces.
Applied and verified settings:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (`.`), **not** `apps/web` |
| Framework | Vite |
| Node.js | 22.x, matching `.nvmrc` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `apps/web/dist` |
| Production Branch | The branch you intend to publish; do not assume its name |

`vercel.json` supplies install/build/output settings and the public page rewrites.
Git LFS is enabled in the project settings. Keep it enabled and verify the next
Git-based deployment: the existing studio panorama is an LFS object. Without LFS, a build can succeed while
shipping its text pointer instead of an image. Check the rendered panorama after
deployment. [Vercel LFS settings](https://vercel.com/docs/project-configuration/git-settings)
explain this separate project setting. The repository also holds large Blender
source objects, so inspect checkout/download size before the first hosted build.

Direct links to `/how-it-works`, `/gallery`, `/roadmap`, `/support`, `/account`,
`/privacy`, `/terms` and `/try` load the app. Missing API and asset paths keep a
real 404 instead of receiving HTML disguised as an API response. Add page metadata and a rewrite when adding another public page.

Set `VITE_PUBLIC_SITE_URL` to the published site origin for static Open Graph
URLs (it defaults to the live `https://passthecanvas-party.vercel.app` preview).
Change it in Vercel when connecting the custom domain, then rebuild. This connection returned 403 when attempting to create that non-secret project variable;
the default is already correct for the current live site, so no variable is needed
for this first release. Every public route gets its own HTML metadata
shell during `npm run build`; this is not full server rendering.

Leave account environment variables empty for the first website preview.
Vercel's native Git integration creates previews for branch changes and updates
the chosen production branch automatically. No Vercel deployment token is needed
in GitHub Actions. Confirm the imported repository and production branch before
enabling that behavior. [Vercel Git integration](https://vercel.com/docs/git/vercel-for-github)
and [Vite deployment routing](https://vercel.com/docs/frameworks/frontend/vite)
describe the provider behavior.

The supplied `Checks` GitHub workflow runs type checks, tests and a production
build on pushes and pull requests. It checks source without downloading the
repository's Blender LFS objects; it does not prove that hosted image assets were
resolved. Enable the check named **Type checks, tests
and build** in the production branch's GitHub ruleset before merging. Vercel Git
deployments can run while Actions is still running; branch protection prevents
merging a failing pull request, but does not make direct production pushes safe.
Restrict direct pushes, or separately configure Vercel Deployment Checks if a
release must wait for CI. The workflow itself does not deploy.

After reviewing the preview, add `passthecanvas.party` in Vercel's Domains panel
and apply the DNS records Vercel shows. Do not guess DNS values.

## 2. Railway account/party service

Create a persistent Railway service from the same repository when ready. Keep
its Root Directory at the repository root so npm can resolve `@ptc/shared`.
Select the repository's `railway.json` configuration. It supplies:

- Railpack builder and shared/server type checks as the build command.
- `npm run start --workspace=@ptc/server` as the start command.
- `/health` as the deployment healthcheck.
- Server/shared/lockfile watch patterns so website-only changes do not restart
  the party service.

Set the following Railway service variables in the dashboard:

| Variable | Value / purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `RAILPACK_NODE_VERSION` | `22` |
| `RAILPACK_NO_SPA` | `true`; this service runs the Node server, not the website |
| `RAILPACK_NODE_NPM_INSTALL` | `npm ci --include=dev` |
| `RAILPACK_PRUNE_DEPS` | `false`; the existing start command uses `tsx` from devDependencies |
| `SPOTS_EDITOR` | `0`; disables the development-only art/spots write routes |
| `CLERK_SECRET_KEY` | Clerk server key, entered only on Railway |
| `DATABASE_URL` | Reference Railway Postgres's connection URL in the service |
| `ACCOUNT_ALLOWED_ORIGINS` | Exact published HTTPS frontend origins, comma separated |

Let Railway supply `PORT`; the server already reads it. Generate the service's
HTTPS public domain. Keep one replica: party state currently lives in memory,
and multiple replicas would hold different parties. Leave application sleeping
off for live parties. Railway's healthcheck proves startup, not Clerk, Postgres,
LiveKit, ongoing uptime or the ability to recover an active party after restart.

The current snapshots folder is `apps/server/data/snapshots` when started through
the npm workspace command. It is ephemeral without a volume. If testing saved
party snapshots on Railway, mount a volume at the corresponding absolute path
inside the deployment (for Railpack's `/app` working directory:
`/app/apps/server/data`). This is separate from account preferences in Postgres.
Durable replay storage, active-party recovery and backup policy remain future
work; a volume does not provide those features.

Enable Railway's **Wait for CI** setting after GitHub access is connected. The
workflow runs on push, so Railway can wait for the check suites before deploying.
See [Railway config reference](https://docs.railway.com/config-as-code/reference),
[Railpack Node settings](https://railpack.com/languages/node/) and
[GitHub autodeploys](https://docs.railway.com/guides/github-autodeploys).

## 3. Connect Clerk and saved account views

Configure email verification code sign-in in Clerk; Discord is an optional social
connection. Set the production frontend domain and any deliberately enabled
preview domains in Clerk. Use separate test and production instances/keys.

In Vercel, set these **browser-safe, build-time** variables for the intended
environment, then redeploy:

| Variable | Value |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key matching the backend instance |
| `VITE_ACCOUNT_API_URL` | Railway service's HTTPS origin, without a trailing path |

Never put `CLERK_SECRET_KEY`, `DATABASE_URL` or LiveKit secrets in a `VITE_`
variable. Every `VITE_` value is public browser code. Account API access requires
the verified Clerk session and exact allowed frontend origin; do not allow every
`*.vercel.app` origin. Use a stable preview domain and explicitly allow it when
testing account saves.

The first valid authenticated workspace request creates `account_workspaces` if
the configured database user has permission. A missing key, database or allowed
origin leaves account storage unavailable; it does not pretend to save online.
Follow [ACCOUNTS-AND-REPLAY.md](ACCOUNTS-AND-REPLAY.md) for the account contract and
the real signed-in save/reload checks still required.

## 4. Multiplayer is a separate connection step

The public site and painting preview work without a running party server.
Current party WebSockets use same-origin `/party/:id`, and video tokens use
same-origin `/api/token`. Setting `VITE_ACCOUNT_API_URL` connects account storage
only; it does not redirect those party/video requests. Before inviting a live
party, implement the explicit Railway origin for those clients (with origin and
permission checks), or a supported same-origin WebSocket-capable routing layer.
Do not send persistent party WebSockets to a static SPA rewrite.

LiveKit additionally needs `LIVEKIT_URL`, `LIVEKIT_API_KEY` and
`LIVEKIT_API_SECRET` on Railway. Video/audio must never be recorded. Multi-canvas
passing, durable creation playback, opt-in publishing and public gallery storage
remain planned capabilities; the public copy must identify those as in progress.

## Release verification

Run `npm ci`, `npm run check`, `npm test` and `npm run build` locally or in CI.
Inspect the final deployment, not just the build logs:

1. Open every public route directly and reload it. Test 360px and desktop widths,
   keyboard navigation, reduced motion and the painting preview.
2. Confirm `/api/not-a-route` and missing assets return 404 rather than HTML 200.
3. Check Vercel build output and browser console/network for missing textures or
   oversized downloads. Preview infrastructure is not proof of production DNS.
4. After Railway connection, request `/health`, then verify disabled art/spots
   write routes reject requests. Confirm the correct commit/environment is live.
5. After Clerk connection, sign in, save a named view, reload and restore it; sign
   out and use a second account to check isolation. Verify a bad origin and
   unauthenticated request cannot read or write account views.

Review only the intended source/assets before committing. Do not use `git add .`
in this workspace: unrelated Blender work, local renders, private photos, secrets
and generated review output are not part of a website release.

October 30 appearance/room update: production artifact deployment
`dpl_4DnnzbtFiPd63g6eaaAcxgsjfmkm` is READY on the existing stable public alias.
Only compiled public files were uploaded. Restored Vite / Node 22 / npm ci /
`npm run build` / `apps/web/dist` / Git LFS settings after the static upload.
Git remains unlinked pending reviewed source commit; no DNS/backend changes.

October 30 hero/type/color refresh: `dpl_WAsDBv9GR7xn5gjnxqeHHjHbDtvy` READY.
Production alias verified with the interactive room as the hero background and
locally served Days One / Square Peg. Future Git build settings restored; source
remains uncommitted and Git linking is still pending owner review.

October 30 Viga/account-preview artifact: `dpl_DFttQGrKJ1wEikop9gt6wPyoKt4U`
READY. Static frontend only; account backend is not hosted by this artifact.
Railway connection currently needs reauthentication. Follow `ACCOUNT-COMMUNITY.md`
for Clerk/Discord/Postgres/approved-Resend setup and real-session verification.


## October 30 Git build repair

The failed `web` redeploy `dpl_EaNS5j5TngcViP23MmgTiTqJwz3a` still looked for
`dist` after a successful app build, despite updated dashboard settings. Redeploys
inherit original settings unless explicitly overridden. Applied repository root,
`npm ci`, `npm run build`, `apps/web/dist`, Node22 and Git LFS to `web`, then created
a fresh Git-source production deployment of the same commit `6f4808d` with explicit
settings: **`dpl_GPTbn51Zbe23eb6MBdvZPQJ8chhB` READY**. Logs show the root workspace
build and `Deployment completed`. No source fix, new commit, push or DNS edit was
needed. Existing project domain assignments applied automatically.

Unauthenticated HTTPS verification: `/` and `/account` return 200 on
`passthecanvas.party`; the panorama is a real 1,472,468-byte WebP, not a Git LFS
pointer. This verifies the hosted Git build, not account/backend readiness or a
future push-triggered deployment. For further settings changes use a fresh build
or explicitly override inherited settings when redeploying old artifacts.


## October 30 project consolidation and Clerk connection

The live Git-backed project was named `web`, the auto-suggested name for the
`apps/web` import. Its stable ID is `prj_DEd59ZRzvLzafcskn5kcI0E5qHjL`. Renamed it
to **passthecanvas-party** and preserved `passthecanvas.party`, the Git connection
and the fixed repository-root build settings. Fresh Git deployment
`dpl_FozXDE5Pnx2ShWZgU2uq8dLB7dVM` is READY with the custom domain assigned.

The earlier project `prj_ZXyzZKJyDmOAbgQAvGpfFOEgtByd` had only manually uploaded
static previews and no Git connection. It is now **passthecanvas-preview-archive**
and was paused, then permanently deleted after explicit owner confirmation.
The disabled Railway marketplace integration predates these projects; there is
no evidence it created either Vercel project. The direct Railway project works
independently of that old integration.

Clerk's integration had placed Next.js-named keys on the old preview project,
in Development only. Added the existing development publishable key as
`VITE_CLERK_PUBLISHABLE_KEY` to the live project's Production environment and
`VITE_PUBLIC_SITE_URL=https://passthecanvas.party`. Verified the live account
button opens the real Clerk form, explicitly marked Development mode. No server
secret was placed in a frontend variable or source file. Discord has no connection
yet. Production Clerk setup and real session/save/isolation checks remain open.

Railway project `91b6652e-fe6e-476a-8797-5c205e48cff8` has the intended `@ptc/server`
and an unnecessary `@ptc/web` frontend. The server was private and had no app
variables. Applied `SPOTS_EDITOR=0`, `ACCOUNT_ALLOWED_ORIGINS` and
`ACCOUNT_SITE_ORIGIN` for the custom domain. Added the previously approved
Postgres service (`a2969d3c-bb13-483e-ae1c-094e7bb16204`); the server database
reference and existing Clerk secret are now configured on the server. Vercel
required the owner’s passkey/authenticator verification before revealing the key;
the secret was transferred directly into Railway and never written to source,
chat or frontend variables. Real account save/isolation checks remain open.
No Resend email was sent.


### Approved connection completion

Owner approved secret transfer, archive deletion, and committing/pushing the
focused login cleanup. Only the live Vercel project remains. Added production
`VITE_ACCOUNT_API_URL=https://ptcserver-production.up.railway.app`. Railway logs
initially showed the server on injected port 8080 while the domain targeted
8787. Set explicit server `PORT=8787` to match that domain and the local fallback.
Both values must match when changing either setting.

Git-triggered production deployment `dpl_4D2iKecCc6BBYqWTQMhs5b3r1AUK` is READY
for commit `83c867d`; the custom domain visibly serves the new login screen.

The account screen now leads with sign-in, hides unsigned profile/privacy/mail
forms, and offers a native expandable avatar preview. Fresh type checks report
zero errors/warnings; unit tests report 82 passed and 10 optional SQL tests skipped
without the local test database; the production build succeeds. Hosted signed-in
profile persistence and two-account isolation still need real owner sessions.
