# Public site: connect and deploy

The public website and local painting preview can run on Vercel before Clerk,
Railway or LiveKit are connected. They do not need a database to build. The
gallery's examples are demonstrations, not a public feed of guests' work.

The first static preview is live at **https://passthecanvas-party.vercel.app**
in the existing Vercel team `tracyapps-projects`, project `passthecanvas-party`.
The tested static artifact was uploaded directly; Git remains unlinked until the
reviewed source changes are committed. No DNS changes, Git push or service secrets
were configured.

## 1. Vercel website

Use the existing `passthecanvas-party` project rather than importing a duplicate.
After committing/pushing the reviewed source, open **Settings → Git → Connect Git
Repository** and select `tracyapps/passthecanvas.party`. Choose the intended
production branch. These build settings and Git LFS were already applied to the
project for future source builds:

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
