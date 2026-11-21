# Travel route planner

The route planner turns a finished concierge plan into an ordered, transport-aware itinerary
with a one-click Google Maps handoff. It is a pure derivation: it never invents a place, never
changes a day's safety ceiling, and never feeds the dose model. The day plan remains the
agent's narrative; the route is the movement between the places that plan names.

## Inputs and outputs

Inputs:

- `PlannerDay[]` and `PlannerPlace[]` from the concierge plan.
- `transport`: `walk`, `transit`, `car`, or `mixed` (asked on onboarding step 01).
- `origin`: free text such as a home city or airport; may be empty.

Outputs (`TripRoute`):

- One `RouteDay` per trip day: base, ordered stops, legs with a resolved mode, modeled totals,
  a demanding flag, cautions, and a Google Maps URL.
- Trip totals and an arrival link from the origin to the base.

## Pipeline

```text
plan days ──> collect stops ──> pin meals ──> nearest neighbour ──> 2-opt ──> Or-opt
                                   │
                            (slots fixed)          │
                                                   v
                                    legs: walk / transit / car
                                                   │
                                                   v
                          totals · pacing checks · Google Maps links
```

### 1. Stop collection

Only blocks with a `placeId` that resolves to a place with both coordinates become stops. A
place without verified coordinates is dropped from the route, never guessed. A check-in block
for the day's own base is skipped: a zero-length leg to the hotel says nothing. Duplicate
places in one day keep their first slot.

Meals and stays are **pinned**. Reordering a day purely by distance would move dinner to
breakfast, so pinned stops keep their original slot while the remaining stops fill the other
slots in optimized order.

### 2. Ordering

The problem is an open-path TSP per day: start at the base, visit each stop once, end at the
last stop. With at most 32 places and 7 days it is solved with heuristics, not a solver
dependency:

1. **Nearest-neighbour seed** — greedily visit the closest unvisited stop. O(n²). Ties break on
   the stable place id.
2. **2-opt** — reverse a segment when it shortens the path; bounded to four improving passes.
3. **Or-opt** — relocate a one- or two-stop segment when it shortens the path; bounded to three
   passes. This catches the "move one stop across the day" improvement that reversal cannot.

Every step accepts only a strict improvement (`> 1e-9 km`), so the result is deterministic and
never longer than the plan's own order. The return to the base is not part of the modeled
distance; the Maps link closes the loop instead.

### 3. Leg modes

The traveler's mode decides which movements are available:

| Transport | ≤ 0.8 km | ≤ 1.2 km | ≤ 12 km | beyond |
| --- | --- | --- | --- | --- |
| `walk` | walk | walk | walk | walk |
| `car` | walk | car | car | car |
| `transit` | walk | walk | transit | transit |
| `mixed` | walk | walk | transit | car |

A **demanding day** (a hike, or at least 70% of the walking ceiling) sets `avoidWalking`: legs
above 0.6 km use transit or a car when the chosen mode allows one, so the route does not add
walking to a day that is already at its limit. A walk-only trip keeps walking, because the
traveler chose the mode that has no alternative.

Modeled durations use assumed average speeds and access overheads. They are planning
estimates, not live schedules, traffic, or topography.

### 4. Pacing

A day is demanding when it carries a `hike` block or reaches `DEMANDING_WALK_RATIO` (0.7) of its
engine walking ceiling, using the same computed dose as the data loop. Two adjacent demanding
days produce a `pacing_adjacent` caution on the later day. The concierge prompt also forbids
the pattern, and the engine's per-day caps remain authoritative.

The route does **not** move a place to another day. Reassigning days would change the computed
dose, the captured dossier, and the day cards at the same time; that change needs its own
capture-aware step. The route reports the pattern and removes avoidable walking instead.

### 5. Google Maps handoff

Each day builds one Maps URL:

```text
https://www.google.com/maps/dir/?api=1
  &origin=<base>          # the stay, as six-decimal coordinates
  &destination=<base>     # closes the loop back to the stay
  &waypoints=<stop>|<stop>|<stop>
  &travelmode=walking|transit|driving
  &dir_action=navigate
```

- The day link is a loop because a day trip normally returns to the hotel.
- A day with no base uses an open path from its first to its last stop.
- `travelmode` is the mode that carries most of that day's minutes; a `mixed` trip has no
  single Maps mode, so the dominant leg decides.
- At most nine waypoints are sent. A longer day keeps the first nine and shows a
  `truncated_link` caution.
- The arrival link uses the origin as free text and the base as coordinates, because a
  coordinate pair never collides with a same-named hotel in another city.
- No API key, no geocoding, and no request leaves the browser until the reader clicks.

Opening a link sends the stops to Google. The panel says so in one line.

## Complexity

| Step | Cost | Bound |
| --- | --- | --- |
| Distance matrix | O(n²) | n ≤ 32 |
| Nearest neighbour | O(n²) | n ≤ 32 |
| 2-opt | O(passes · n³) | 4 passes |
| Or-opt | O(passes · n³) | 3 passes |
| Mode choice and totals | O(n) | n ≤ 32 |

The whole route for a seven-day plan is computed in well under a millisecond, so it runs in a
`useMemo` beside the plan and needs no server round trip.

## Determinism and tests

No randomness, no clock, no locale output. Identical input produces identical stops, legs, and
URLs. `lib/route/*.test.ts` covers geometry, mode choice, the optimizer against a deliberately
backwards day, pinned meals, base skipping, caps, adjacency, truncation, and exact URL shape.

## Boundaries

- The engine owns step and walking ceilings; the route only reports when its own legs exceed
  them.
- Route walking is separate from the block dose. A hike's walking is counted by the block
  model, not by the leg model, so the panel labels route walking as route walking.
- A place without verified or geocoded coordinates is not plotted and not routed. The
  itinerary list stays the source of truth.
- Transport is not a medical cap. It changes feasibility, time, and how much walking the route
  adds, not the condition profile.

## Open questions

- No live transit schedule, traffic, elevation, or opening hours are modeled. Google Maps is
  where the reader sees real times.
- Meal slots are pinned, but other time windows (museum entry, pharmacy hours) are not.
- A trip with more than one hotel anchors each day at the stay its blocks reference, then at
  the first mapped stay; it does not model moving luggage between hotels.
- Transport and origin are not stored in the trip dossier. The dose loop does not need them;
  the route is recomputed from the plan on every render.
- Cross-day rebalancing of demanding days is deliberately deferred (see Pacing).
- The optimizer assumes the stay with a verified coordinate is the true base. A plan with no
  mapped stay routes each day from its first stop.

## VERIFY

- `lib/route/legs.ts`: 4.5 km/h walking, 18 km/h urban transit, 32 km/h driving, and the access
  and parking overheads are product assumptions, not measured values.
- `lib/route/mapsLink.ts`: Google's Maps URLs reference allows nine waypoints and accepts
  `walking`, `transit`, `driving`, and `bicycling`; confirm the limits and the terms for this
  deep-link handoff before launch.
