# Live venue research

TinyFish is the live page reader. The OpenCode concierge still chooses the places and writes
the route; the biological engine still owns every step and walking ceiling. Venue research is
a display evidence layer between those two: it opens the exact menu or booking URL attached to
a selected place and returns structured facts with a source and a checked time.

The product never invents a price, a menu item, an allergen note, or an availability claim.
A page that does not state a value produces `null`; the interface reads "Not stated". Menu
notes are the venue page's own words and are not a clinical guarantee.

## Endpoint

`POST /api/venue-research` requires Clerk auth and accepts one bounded JSON body:

```json
{
  "destination": "London, Ontario",
  "checkIn": "2026-12-10",
  "days": 4,
  "travelers": 2,
  "places": [
    {
      "id": "place-1",
      "name": "The Park Hotel London",
      "category": "stay",
      "sourceUrl": "https://www.londontourism.ca/the-park-hotel-london",
      "bookingUrl": "https://be.synxis.com/?Hotel=1472"
    },
    {
      "id": "place-4",
      "name": "Organique Cafe & Eatery",
      "category": "eat",
      "sourceUrl": "https://www.happycow.net/...",
      "menuUrl": "https://organiquecafe.com/menu/"
    }
  ]
}
```

The route declares `maxDuration = 300`. A stay job opens `bookingUrl ?? sourceUrl` and runs
only when `checkIn` is present; check-out is `checkIn + days`. An eat job opens
`menuUrl ?? sourceUrl`. At most two hotels and three restaurants are checked per plan, three
browsers at a time.

Only public URLs reach a browser. `lib/venue/url.ts` requires an absolute http(s) URL and
rejects loopback, private, link-local, unique-local, multicast, reserved, and single-label
hosts. The check is syntactic and performs no DNS lookup, so confirm the provider's network
boundary also blocks rebinding and redirects. The route enforces one live pass per account,
two globally, a 30-second cooldown, and eight passes per account per UTC day by default; the
global cap, cooldown, and daily cap have `PLANMYTRIP_VENUE_*` overrides.
`PLANMYTRIP_LIVE_DISABLED=1` pauses new live work without a deploy.

## Timing and failure

- 75s per browser job, 45s recovery from the authoritative run record.
- 255s run budget, leaving room for the terminal frame inside the 300s route.
- One retry per page. The retry prefers the plan's source page when the preferred booking or
  menu URL produced no result.
- A worker failure never aborts its siblings. A partial run keeps every successful fact and
  shows a caution with a retry.
- A missing `TINYFISH_API_KEY` fails each worker with `missing_api_key` and still ends with
  `venue_done`. No key is ever sent to the browser or written to a log.
- No recording is requested or archived. There is no `/api/recordings` route and no
  `TINYFISH_RECORDING` variable; the live preview is the page itself, not a video.
- A saved trip does not store venue evidence. Its "Checked places" section offers an explicit
  "Refresh menus and rates" action, so opening a saved page never starts a live check.

## Events

Every frame carries `worker`, `seq`, `ts`, and optional `cached`. `venue_done` is always last.

| Event | Meaning |
| --- | --- |
| `venue_started` | The bounded worker roster. |
| `venue_status` | Preparing, reading, checked, or failed. |
| `venue_activity` | One accepted search, read, note, or error line. |
| `venue_streaming_url` | A live TinyFish preview URL. |
| `venue_sources` | The source ledger grows. |
| `venue_result` | One validated menu or hotel snapshot. |
| `venue_error` | One calm failure code and message. |
| `venue_done` | Completed, failed, and summary counters. |

`hooks/venueFrames.ts` validates every frame and rejects unknown events, unsafe preview URLs,
bad worker ids, and malformed evidence. `lib/venue/venueState.ts` is the pure reducer.

## Interface

`VenueMissionControl` carries a four-cell run bar (pages, clock, evidence, sources/actions),
venue tabs, a focused live browser, merged activity, the source ledger, and checked facts.
One iframe per venue stays mounted while hidden; a completed browser is replaced by the
checked facts rather than replaying a stale preview. The per-page clock, action count, LIVE
marker, and Fullscreen action are real state. Checked evidence also appears on the plan's
selected-place rows and in the plan summary line.

## Cache

`lib/cache/venueCache.ts` uses a v2 identity of kind, URL, place id, and for hotels the dates
and party size. The place id prevents two restaurants that share a city listing URL from
overwriting each other. Menus live 7 days; room rates 12 hours. The cached envelope stores the
evidence, recorded sources, recorded activity offsets, and duration. A hit replays the real
recorded telemetry with `cached: true`; an evidence-only legacy row still reads and gains its
checked page as a source.

## Safety

Venue facts never change the safety envelope, the computed dose, the day ceilings, or the
health score. They answer "what does this page say today?" and nothing more.
Prices are display-only; they do not enter the training row. The interface says "checked
snapshot, not a booking guarantee" and asks the reader to confirm allergens, cross-contact,
hours, and the final rate with the venue.

## Live checks

- 2026-11-22, London, Ontario, cached plan, 4-day dates 2026-12-10 to 2026-12-14, 2 travellers.
  A full live pass checked The Park Hotel London at CA$199.00 a night through Synxis, Udupi
  Dosa at 12 Toast menu items from CA$5.99 to CA$8.99, and Organique Cafe at 12 menu items from
  CA$5.50 to CA$8.50. Locomotive Espresso initially failed after the HappyCow listing and
  official site did not expose a priced menu; the tile kept a retry and the other facts stayed
  usable. A later retry found `locomotiveespressonorth.restaurants-us.com/menu` and returned 12
  priced items from CA$3.00 to CA$5.00. That third-party source is shown verbatim, so the
  reader can judge it.
- The same pass showed the live TinyFish preview iframe, the elapsed clocks, 40 accepted
  browser actions, and the checked evidence cards. A re-run replayed three cached records
  immediately and opened only the failed page. The final cached London state has all four
  pages, 3 menus, 1 room quote, 36 items, 10 sources, and 45 recorded actions.
- The preview URL redirects to the provider's `tetra-streaming.tinyfish.io` DevTools inspector.
  It is treated as a live page, never archived. Headless screenshot tooling can show the
  inspector surface as blank even while the remote target is attached; a normal browser is the
  acceptance check.
- Hotel pages that state only a nightly rate leave total and taxes "Not stated"; the card does
  not infer them from a nightly price.
- A listing page without prices produces a zero-item menu with the page's own explanation, not
  a fabricated menu.
