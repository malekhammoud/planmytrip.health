# Billing

## Launch configuration

Clerk Billing is enabled for the production application
`app_3MR7sJ2fhslkGXYl4yRqjseO13C`. The launch catalog is intentionally small:

| Plan | Price | Who it is for |
| --- | --- | --- |
| **Free Preview** (`free_user`) | $0 | A first, low-commitment plan with the safety envelope. |
| **Care Circle** (`care_circle`) | $9/month or $60/year | Patients and caregivers planning up to two trips a month. Annual is the intended plan. |

The annual price is entered through Clerk's monthly-equivalent field: `500` cents
($5.00/month) produces a $60.00 annual total. Clerk Billing only supports USD. The
PricingTable shows both intervals because this production instance is not opted into
Clerk's separate "Annual-only plans" update. When that update is enabled in the Clerk
Dashboard, set `amount` to `0` in `scripts/clerk-billing.json`, re-apply the config, and
the monthly option disappears.

Clerk Billing supports recurring subscriptions only. The research-recommended $29 one-time
Trip Pass is therefore not implemented here. The monthly Care Circle price is a fair
low-commitment option; annual is the better value for the repeat user. A true
one-time pass needs Stripe Checkout outside Clerk Billing.

## Entitlements

The app maps Clerk features to product limits in `lib/billing/plans.ts`. The feature slugs
must match Clerk exactly.

| Feature | Free Preview | Care Circle | Server enforcement |
| --- | --- | --- | --- |
| `safety_envelope` | yes | yes | Always free; never paywalled. |
| `preview_live_plan` | yes | yes (display) | Free live plans are capped at one per calendar year. |
| `one_saved_trip` | yes | yes (display) | Free saved trips are capped at one. |
| `long_trips` | no | yes | `/api/agent-plan` rejects more than 7 days for free; Care Circle gets 20. |
| `live_verification` | no | yes | `/api/travel-swarm` returns `403 upgrade_required` without it. |
| `venue_research` | no | yes | `/api/venue-research` returns `403 upgrade_required` without it. |
| `two_live_plans` | no | yes (display) | `tripsPerPeriod: 2` per month for Care Circle; one per year for Free. |
| `saved_trips_unlimited` | no | yes | `/api/saved-trips` enforces the free one-trip cap. |

`lib/billing/server.ts` reads `auth()` once and exposes `userId` plus an entitlement
snapshot. Every paid API checks it server-side; client hiding is only an affordance.

Live (uncached) planner runs are counted in `billing_usage` by Clerk user, metric, allowance
period, and run id. A cache hit, a mock run, and a repeated terminal frame do not consume a
plan. The counter is not a substitute for a billing webhook; it is a product fair-use guard.
Care Circle includes 2 live plans per calendar month. The verification and venue routes are
paid features; cached results make repeated checks cheap.

The current free limits are:

- one live plan per calendar year
- seven days maximum
- one saved trip
- no live TinyFish verification or venue research
- safety envelope and care card always available

The current Care Circle limits are:

- two live plans per calendar month
- twenty days maximum
- unlimited saved trips
- live verification and venue research
- safety envelope and care card always available

## UI and management

- `/pricing` renders Clerk's `PricingTable` with the Paper and Ink appearance bridge.
- `/account` renders `UserProfile`, including the plan, payment method, invoices, and
  cancellation/plan switching.
- The signed-in header links to Plans and Saved trips; the public header links to Pricing.
- Free surfaces show an upgrade callout instead of a control that would fail.
- `SaveTripButton` handles the server's `saved_trip_limit` response and links to plans.
- A successful checkout returns to `/pricing?checkout=success`; the page reports whether
  the session already carries the paid plan.

## Applying the catalog

`scripts/clerk-billing.json` is the reproducible production catalog. It contains no
secrets. Use the uploaded production schema as the source of truth.

```bash
npx -y clerk@latest auth login
npx -y clerk@latest config pull \
  --app app_3MR7sJ2fhslkGXYl4yRqjseO13C \
  --instance prod --keys billing
npx -y clerk@latest config patch \
  --app app_3MR7sJ2fhslkGXYl4yRqjseO13C \
  --instance prod --file scripts/clerk-billing.json --dry-run
npx -y clerk@latest config patch \
  --app app_3MR7sJ2fhslkGXYl4yRqjseO13C \
  --instance prod --file scripts/clerk-billing.json --yes
npx -y clerk@latest api \
  --app app_3MR7sJ2fhslkGXYl4yRqjseO13C --instance prod /billing/plans
```

The dashboard selection does not authenticate the CLI. A secret key can read
`/v1/billing/plans`, but plan creation and config patches require a platform session
(`clerk auth login` or `CLERK_PLATFORM_API_KEY`).

## Billing lifecycle

The app does not store a duplicate subscription table. Clerk embeds the active plan and
feature claims in the session, and `auth().has()` is the authorization source. `UserProfile`
handles cancellation, payment methods, and invoices. Billing webhooks are not required for
access control and are not implemented yet; add them only when a product feature needs the
lifecycle events (for example, email reminders or a local invoice archive).

If webhooks are added, use Clerk's dot-notation events (`subscription.created`,
`subscription.active`, `subscription.updated`, `subscriptionItem.canceled`,
`subscriptionItem.pastDue`, `subscriptionItem.ended`) and verify them with
`verifyWebhook`. Never place auth protection on the webhook route.

## Clerk Billing limitations

- USD only. There is no CAD currency in Clerk Billing.
- No tax or VAT calculation. Use Stripe Tax or a merchant-of-record if required.
- No 3-D Secure. Cards that require a challenge fail.
- Recurring subscriptions only; no one-time Trip Pass.
- No refunds inside Clerk Billing. Refunds are issued in Stripe and do not change Clerk MRR.
- Clerk Billing adds 0.7% of billing volume on top of Stripe processing.
- Clerk has no native metered quotas. The app's `billing_usage` counter is the fair-use
  mechanism.
- Free trial eligibility is tied to the verified primary email. There is no free trial in
  the launch catalog.

## Pilot checks

- The shipped launch price is $9/month or $60/year, intentionally below the $79/year
  research target so the first paid plan stays fair for patients and caregivers. Two live
  plans a month is 24 live plans a year; at $2-$4 of compute per live trip, heavy use can
  exceed the annual price. Monitor p95 cost and add a fair-use limit or price test if needed.
- Free to Care Circle conversion, checkout completion, and 12-month renewal intent.
- Cost per live plan and per verification from TinyFish and OpenCode logs; the target is
  under $10 p95 per paid trip.
- Which plan interval users choose, and whether the monthly option cannibalizes annual.
- Refund, cancellation, and failed-payment reasons.
- A real checkout in production with a real card before announcing the plan. The Clerk
  development gateway can be used in a development instance; production uses the connected
  Stripe account.
