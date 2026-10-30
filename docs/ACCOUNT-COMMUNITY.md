# Account studio: implementation and connection handoff

Checked October 30, 2026. This is a locally verified account foundation, not a
claim that hosted accounts, Discord OAuth, Resend delivery or durable party
recaps are live. Railway connector inspection returned reauthentication required.
No local Clerk/database credentials were supplied. Resend was explicitly approved
by the owner during this implementation; no provider account or message was created.

## What is implemented

- The existing Clerk JavaScript client now loads Clerk 6's separate prebuilt UI,
  opens sign-in and account management, and shares identity-protected requests.
  Email codes and Discord appear only when enabled on the real Clerk instance.
  [JavaScript integration](https://clerk.com/docs/js-frontend/getting-started/quickstart),
  [production Discord setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/discord).
- `/account` is a private studio screen: profile/name/bio, original local SVG
  avatar colors/marks, explicit profile sharing, friend-request preferences,
  notification opt-ins, mutual connections, schedules, RSVPs and calendar export.
  While unconfigured, visitors get an honestly labeled unsaved avatar preview.
- `community-schema.sql` and `community-store.ts` persist records in the approved
  Postgres database. The verified Clerk subject is the storage/authorization key;
  unrelated UUIDs identify shareable profiles. Emails and OAuth tokens are absent
  from these tables and profile payloads. Schema initialization is transactionally
  serialized; runtime role initially needs table/index creation permission.
- Friend requests require an explicitly shared profile with requests enabled;
  recipient acceptance is mandatory. Decline/remove prevents repeat requests for
  that pair. Connected friends can view each other's profiles even if link sharing
  is later disabled. There is no global user search or email-address lookup.
- A scheduled party stores UTC start plus IANA zone, duration and host. A host can
  invite connected account friends; the recipient can RSVP. A 256-bit share token
  permits a signed-in recipient to view the invitation and RSVP after saving a
  profile. Tokens are hashed in Postgres, expire at party start, and can be replaced
  or cancelled. URL fragments keep raw tokens out of ordinary HTTP access logs.
  Shared invitations do not disclose attendees, their addresses or provider IDs.
- Calendar files use absolute UTC instants, escaped/folded UTF-8 and a 15-minute
  display alarm. A user's calendar controls whether that alarm appears. This does
  not create a hosted email or push reminder and cancellation does not silently
  update an imported calendar file.
- The approved Resend adapter uses built-in fetch, no SDK dependency. An outbox
  stores invitation/reminder jobs, leases one at a time, and rechecks current
  consent, friendship/RSVP, cancellation and start time before sending. Primary
  recipient email is read from Clerk only if verified. Provider-accepted status is
  distinct from inbox delivery. Retry keys are stable; uncertain delivery stops
  after 23 hours, before Resend's 24-hour idempotency retention expires.
  [Resend API](https://resend.com/docs/api-reference/emails/send-email),
  [idempotency](https://resend.com/changelog/idempotency-keys).

## APIs and source ownership

All account-community routes are under `/api/account/community`, require a verified
active Clerk session and exact allowed Origin, and return `Cache-Control: no-store`.
GET root returns only that account's dashboard. GET `/profile?id=…` enforces sharing,
ownership or relationship. GET `/invitation?token=…` returns invitation details.
PUT `/profile` validates bounded names/bios, fixed avatar choices and booleans.
POST commands: `/friends`, `/friends/respond`, `/parties`, `/parties/invite`,
`/parties/respond`, `/parties/join`, `/parties/cancel`, `/parties/link`.
Bodies cannot select another owner. No HTTP endpoint writes completed attendance
or painting history. Shared HTTP types are additive; the WebSocket protocol is
unchanged. Only a future trusted server adapter may write `studio_party_history`.

## Connection order

1. Reauthenticate the Railway connector. Reuse the approved Railway project and
   Postgres if already created; do not make a duplicate. Connect the existing Node
   server using the repository deployment handoff, with developer write routes off.
2. Configure Clerk email verification codes and optional Discord. Production
   Discord needs an owner-created Discord application, Clerk's exact redirect URL,
   and client credentials entered in Clerk's dashboard. Keep account linking inside
   Clerk's verified UI, never merge records by display name. No Discord bot, guild
   access or message scopes are needed.
3. Server-only configuration: `CLERK_SECRET_KEY`, `DATABASE_URL`, exact
   `ACCOUNT_ALLOWED_ORIGINS`. Web build: `VITE_CLERK_PUBLISHABLE_KEY` and
   `VITE_ACCOUNT_API_URL` pointing to the actual HTTPS account server. Keys belong
   in the service settings / ignored .env files; don't send them in chat or commit.
4. Confirm runtime schema initialization on the real database. Open two separate
   signed-in sessions: create profiles, request/accept friendship, create schedule,
   invite/RSVP, replace link and cancel. Switch accounts and verify no private data
   leaks. Disable the database and verify failed saves never report success.
5. Resend: verify an owned sender domain, configure sender address, disable open
   and click tracking, confirm expected invitation use case, implement/test bounce
   and complaint suppression handling, and use consenting recipients for delivery
   checks. Add `RESEND_API_KEY`, `RESEND_FROM`, `ACCOUNT_SITE_ORIGIN` and only then
   set `ACCOUNT_EMAIL_ENABLED=1`. Defaults are off. No arbitrary email-recipient
   input is accepted; nonmembers use manual email/share links for now.
6. Worker runs every minute inside the long-running Node service, backed by the
   same Postgres. No Vercel browser timer or extra scheduler service. Test restart,
   duplicate workers, failed provider requests, changed consent, cancelled parties
   and uncertain jobs requiring review. Keep operational logs free of addresses.

## Party history and recap integration: next slice

Current party identity is an ephemeral member ID and cannot safely be treated as
an account ID. Implement an authenticated HTTPS exchange for a short-lived,
single-use join ticket, then extend shared join types and both apps together.
Preserve guest presence and account-free participation. On join the server verifies
and binds the account, never trusts a client-supplied profile/Clerk ID. This protocol
change requires review/approval under AGENTS.md before implementation.

Once those bindings and durable art access exist:

1. Live attendee cards show a verified profile and Add friend. Nonaccount guests
   are clearly guests. Private/request-disabled profiles remain protected.
2. The party server writes completion/contribution records and frozen attribution,
   not a client-submitted attendance list. Painting history links only to paintings
   the viewer may access; public sharing remains an explicit owner/contributor act.
3. The private recap composes the room panorama, framed finished artwork and
   approved avatar/name representations. **Never capture webcam tiles**, audio or
   the participant's browser screen. Rendered room imagery is not a call recording.
4. The attendee list offers profile, Add friend and deliberately shared paintings.
   Both list and artwork have keyboard paths. Removed/private accounts, guests,
   denied access and deleted artworks have clear fallbacks.
5. Add rescheduling, account deletion/retention, recipient blocking/reporting and
   nonmember RSVP before enabling broad public account use. Finished-party history
   stays empty until actual server completion exists; no fabricated example events.

## Fresh verification

`npm run check` and production build pass. Local Postgres 18 was started in an
isolated temporary cluster; the integration suite uses a new random schema, then
removes only that schema. To repeat against a **local test database**:

```
PTC_TEST_DATABASE_URL=postgres://TEST_USER@127.0.0.1:TEST_PORT/TEST_DB npm test
```

The database tests refuse nonlocal hosts. They exercise actual SQL, HTTP identity
isolation with an injected test verifier, profile sharing, friend consent, host-only
invites, RSVP, hashed link rotation/expiry/cancel, immutable history boundaries,
opt-in mail, duplicate workers, mid-lookup opt-out and bounded retries. No Clerk or
Resend call is made by tests. This is not proof of real OAuth or inbox delivery.
Without that environment variable, SQL integration tests are explicitly skipped;
they are not replaced with an in-memory success fallback.
