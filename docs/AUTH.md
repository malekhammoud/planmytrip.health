# Accounts and saved trips

## Identity

Clerk is the identity source. The app does not store passwords, OAuth tokens, or a
duplicate user profile. The production application is
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. It is served through the same-origin Frontend API proxy
at `https://planmytrip.health/__clerk`; the browser does not need to reach
`clerk.planmytrip.health` directly.

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Browser and server render | Public by design. |
| `CLERK_SECRET_KEY` | Server only | Never expose to client code, logs, or the repo. |
| `NEXT_PUBLIC_CLERK_PROXY_URL` | Browser and server render | Defaults to `/__clerk`; must match the Clerk domain `proxy_url`. |

Production values live in `/etc/planmytrip.env`, owned by root and read by systemd.
Local values belong in `.env.development.local`; never commit either file. The Dashboard
selection does not authenticate the Clerk CLI. Run `npx -y clerk@latest auth login` in a
host terminal before CLI commands that target the application, such as `config pull`,
`env pull`, or `deploy status`.

## Required sign-in

Planning requires an account. The protected resources enforce their own checks:

- `app/page.tsx` reads `auth()`: a signed-out visitor gets the public landing page rendered
  in place, not a redirect; a signed-in visitor gets the planner.
- `app/trips/page.tsx`, `app/trips/[id]/page.tsx`, and `/account` redirect signed-out visitors
  through `signInHref`, which keeps a validated return path.
- `/api/agent-plan`, `/api/travel-swarm`, `/api/venue-research`, and `/api/trips/outcome`
  return `401` JSON without a Clerk session.
- `/api/saved-trips`, `/api/saved-trips/[id]`, and `/api/account/delete` return `401` JSON
  without a session.

`proxy.ts` installs `clerkMiddleware`, which makes the session available to server code,
and handles the same-origin Frontend API proxy. It is not the authorization boundary.
The wrapper forwards only Clerk's `x-clerk-*` request headers plus the internal `x-ops-token`
and `x-request-id` headers the local health probe needs. Next 16.4.6 hangs if Clerk's full
request-header override set (including `host` and `connection`) is returned unchanged; that
filter is load-bearing. `/sign-in` and `/sign-up` are public, as are `/model`, `/privacy`,
`/terms`, `/pitch`, and static assets. The old install-scoped `GET /api/trips` log and
`/api/recordings` route were removed.

## Sign-in form appearance

Clerk's prebuilt form does not resolve `var(--accent)` or the other Paper and Ink custom
properties inside its own color variables; the primary button renders transparent. The form
therefore receives literal token values from `lib/clerkAppearance.ts`. Keep those values in
sync with `app/globals.css` when the palette changes. The design guard does not scan `lib/`.

Google is not enabled on the production instance. `user_settings.social` is empty, so Clerk
renders email and password only. Production instances require a custom Google OAuth client ID
and secret in the Clerk dashboard; shared development credentials are not valid in production.

## Return paths

`lib/redirects.ts` owns the only return-path check. A path must be an absolute same-origin path:
it must start with one `/`, must not start with `//`, must not contain a backslash or a control
character, and must stay under the length bound. Absolute URLs, protocol-relative URLs,
backslash tricks, and malformed values are dropped rather than repaired. `/trips`,
`/trips/[id]`, and `/account` pass the current path through `signInHref`, so a signed-in
traveler lands back where they started and an unsafe `redirect_url` never becomes an open
redirect.

## Saved-trip schema

`npm run db:init` creates `saved_trips` idempotently:

```text
saved_trips
  id             TEXT PRIMARY KEY          server-generated UUID
  clerk_user_id  TEXT NOT NULL             Clerk user id
  run_id         TEXT NOT NULL             browser run id used for idempotent saves
  created_at     TIMESTAMPTZ NOT NULL
  updated_at     TIMESTAMPTZ NOT NULL
  destination    TEXT NOT NULL             list summary
  days           INTEGER NOT NULL          list summary
  condition      TEXT NOT NULL             list summary
  trip_json      JSONB NOT NULL            normalized TripConfig
  plan_json      JSONB NOT NULL            normalized AgentTripPlan snapshot
  UNIQUE (clerk_user_id, run_id)
```

Every query is scoped by `clerk_user_id`. Saving the same run twice updates the same row.
Another account cannot read, overwrite, or delete the row. The stored plan is rebuilt
through `normalizeWirePlan` before it is written and again before it is rendered.

`trip_captures` is deliberately unchanged. The ML capture remains consent-gated and keyed
by the random browser install id; it does not store the Clerk user id. A saved trip is
account data, while a training row stays an anonymous research copy. Deleting a saved trip
does not delete a consented research capture.

## Flow

1. The signed-in traveler builds a plan.
2. `SaveTripButton` posts `{ runId, trip, plan }` to `/api/saved-trips`.
3. The server validates the Clerk session, trip, and plan, then upserts `saved_trips`. The
   free one-trip limit is checked before the write and returns `saved_trip_limit`.
4. `/trips` lists only that account's summaries, 30 per page, with Older/Newer links. It has
   no total count.
5. `/trips/[id]` verifies ownership, reads the snapshot, and renders `SavedTripView`.
6. The saved view rebuilds the deterministic engine envelope from the saved trip. The
   concierge plan, places, sources, and caps remain the captured snapshot. Destination
   findings and venue evidence are not stored; "Refresh menus and rates" is an explicit
   action, so opening a saved trip never starts a live check.
7. Delete asks for a second confirmation, removes only that account's row, and returns to
   `/trips`.

`POST /api/account/delete` closes the account. It rejects a request whose `Origin` does not
match the host, deletes the account's `saved_trips` and `billing_usage` rows in one
transaction, and only then deletes the Clerk user. If the database cleanup fails, the Clerk
account stays open so the traveler can retry. Anonymous research captures are not linked to
the account and are deliberately untouched.

## Privacy and operations

- The browser sends the destination, health profile, preferences, dates, and party size to
  the configured OpenCode model provider. A destination check sends the destination and
  health profile to TinyFish; venue checks send the selected menu or booking URL, dates, and
  party size. Clerk receives account and session data. Place queries go to the configured
  geocoder. Capture remains opt-in and separate.
- `/privacy` and `/terms` are public pages linked from the footer. They describe the account,
  anonymous research, live checks, geocoding, map tiles, the Google Maps handoff, feedback,
  and operational error reports. They need legal review before a paid pilot.
- Account deletion removes account-owned rows; backups, retention windows, monitoring, and a
  retention/deletion answer for anonymous captures are still required before charging users.
- Rotate the live secret key after any exposure. Replace it in `/etc/planmytrip.env`,
  rebuild if needed, and restart `planmytrip.service`.
- The production app uses Clerk's domain `proxy_url` instead of a public
  `clerk.planmytrip.health` CNAME. Confirm the domain's required email and account-portal
  CNAME records in the Clerk Dashboard, and confirm the sign-in methods you want before
  announcing the feature.
- The Clerk CLI session is stored for the root user and can expire. If `clerk whoami` reports
  `auth_required`, run `npx -y clerk@latest auth login` before `config pull`, `env pull`,
  `deploy status`, or any other account-level command. See `docs/BILLING.md` for the plan
  catalog commands.
