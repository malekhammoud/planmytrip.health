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

- `app/page.tsx` reads `auth()` and redirects signed-out visitors to `/sign-in`.
- `app/trips/page.tsx` and `app/trips/[id]/page.tsx` redirect signed-out visitors.
- `/api/agent-plan`, `/api/travel-swarm`, `/api/trips`, and `/api/trips/outcome` return
  `401` JSON without a Clerk session.
- `/api/saved-trips` and `/api/saved-trips/[id]` return `401` JSON without a session.

`proxy.ts` installs `clerkMiddleware`, which makes the session available to server code,
and handles the same-origin Frontend API proxy. It is not the authorization boundary.
The wrapper forwards only Clerk's `x-clerk-*` request headers. Next 16.4.6 hangs if Clerk's
full request-header override set (including `host` and `connection`) is returned unchanged;
that filter is load-bearing. `/sign-in` and `/sign-up` are public, as are `/model`, `/pitch`,
and static assets.

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
3. The server validates the Clerk session, trip, and plan, then upserts `saved_trips`.
4. `/trips` lists only that account's summaries.
5. `/trips/[id]` verifies ownership, reads the snapshot, and renders `SavedTripView`.
6. The saved view rebuilds the deterministic engine envelope from the saved trip. The
   concierge plan, places, sources, and caps remain the captured snapshot.
7. Delete removes only that account's row and returns to `/trips`.

## Privacy and operations

- The browser sends the destination, condition, medication name, and preferences to the
  configured OpenCode model provider. Clerk receives account and session data. Place
  queries go to Nominatim. Capture remains opt-in and separate.
- A full account-deletion path is not implemented. A user can delete each saved trip;
  Clerk account deletion must also clean up `saved_trips` by `clerk_user_id`.
- Backups, retention windows, monitoring, and a privacy review are still required before
  charging users.
- Rotate the live secret key after any exposure. Replace it in `/etc/planmytrip.env`,
  rebuild if needed, and restart `planmytrip.service`.
- The production app uses Clerk's domain `proxy_url` instead of a public
  `clerk.planmytrip.health` CNAME. Confirm the domain's required email and account-portal
  CNAME records in the Clerk Dashboard, and confirm the sign-in methods you want before
  announcing the feature.
- The Clerk CLI is not authenticated on this host. Run
  `npx -y clerk@latest auth login` before `config pull`, `env pull`, `deploy status`, or any
  other account-level command.
