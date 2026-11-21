# Pitch deck and demo runbook

The deck is a static 1920×1080 artifact in `public/pitch/`, served at
`https://planmytrip.health/pitch` by a rewrite in `next.config.ts`. It is presentation-only:
it is not an app route, it is not covered by the design guard, and it adds no application code.

Keys: `→` / `Space` advance, `←` back, `Home` / `End` jump, `F` fullscreen. The deck also
prints to PDF at 13.333 × 7.5 in; use the PDF as the offline fallback.

## The 3:00 script

Target 2:55, leaving five seconds of breathing room. Do not read the slides. The slides carry
the evidence; the script carries the argument.

| Time | Slide | Beat |
| --- | --- | --- |
| 0:00–0:22 | 1. Basil | The story |
| 0:22–0:37 | 2. Problem | The number and the gap |
| 0:37–0:56 | 3. Solution | Plan, pace, prove |
| 0:56–2:04 | 4. Demo | Live product |
| 2:04–2:20 | 5. Architecture | Why the ceiling is deterministic |
| 2:20–2:31 | 6. Comparison | The missing layer |
| 2:31–2:43 | 7. Impact | Who it helps, what changes |
| 2:43–2:49 | 8. Close | Basil |

### 0:00 — cover

> Basil loved to travel. He also had cancer. He died in February 2024, at 33. The trips were
> never the problem. Planning them was. Which day is too long. Is his medication legal at the
> border. Will insurance pay. He did that alone, at two in the morning.

Pause after “33.” Do not perform the grief; state it.

### 0:22 — problem

> Basil wasn’t rare. Forty-five percent of Canadians live with a chronic disease. One in
> twelve lives with three or more. Two-thirds of adults over 50 plan a trip this year. No major
> planner asks about any of it.

### 0:37 — solution

> So we built the planner that starts with the body. Plan it: six specialists research, a
> concierge puts the route in order. Pace it: the engine sets daily step and walking caps.
> Prove it: three live browsers check advisories, drug rules, insurance. Every finding cited.

### 0:56 — demo

Tab B is the run started two minutes ago. Tab A is the run started twenty-five minutes earlier.

> This run is live. Seven agents: stays, tables, trails, culture, transit, care, and a lead
> concierge. You’re watching them search.

*(click Verification)*

> Three real browsers, live. Canada’s advisory. Drugs.com. Sun Life. Not cached.

*(switch to tab A, Plan)*

> Same run, finished. Every place verified, sequenced by day.

*(point at the day rows)*

> Each day carries the agent’s estimate and the engine’s ceiling. The agent can suggest a day.
> It cannot lift the cap.

*(click Verification)*

> Every finding carries the page and the time we read it.

*(click Pacing)*

> The engine’s envelope. Same inputs, same caps. One click: the care card — the days, the caps,
> the checkpoints.

### 2:04 — architecture

> Under the hood: the planning team is probabilistic. The ceiling is not. Pure TypeScript, same
> inputs, same caps. The verifiers are real browsers on live sites, so they hold up where
> scrapers break.

### 2:20 — comparison

> Google plans the route. Tripadvisor plans the sights. Your insurer knows the policy. None know
> you’re the patient. We do — and we show our work.

### 2:31 — impact

> For people managing a condition, the caregiver at 2 a.m., the clinician who gets a summary.
> Hours of tabs become twelve minutes. A guess becomes a citation.

### 2:43 — close

> Basil would have gone anyway. The planning should have been easier.

Stop. Hold the slide. No “thank you.”

## Demo runbook

### Before the room

1. Open tab A. Complete onboarding with the exact demo inputs. Press Build my plan at T−25.
   Leave it on the Plan tab.
2. Open tab B. Complete onboarding with the same inputs at T−2. Press Build my plan. Leave it
   on the Plan tab.
3. Browser zoom 90%, window about 1600×1000, bookmarks bar hidden, notifications off.
4. Confirm both runs are live: tab A should finish before the pitch; tab B should still show
   the roster and activity log.
5. Keep a recorded clean run in tab C and the PDF on the desktop.

Never refresh either tab and never press Plan again during the pitch. Both remount the
workspace and abort the running streams.

### Fallback ladder

1. Both runs live: the script above.
2. Tab B slow or stuck: talk over the roster; the queued agents are still evidence.
3. Tab A failed: use the recorded run and say “recorded live, unedited.”
4. Network gone: PDF plus the recording. The deck never depends on the network.

### The 0-of-5 audit

The problem slide claims 0 of 5 major planners ask about health. Before presenting, open the
trip-planning flow in Google Travel, Tripadvisor, Expedia, Booking.com, and Kayak and screenshot
the input steps. Keep the screenshots in the speaker notes. If any planner asks, change the
number and the source line.

## Sources

- **45% and 1 in 12**: Statistics Canada, “A glimpse at the health of Canadians” (2021 data):
  45.1% lived with at least one major chronic disease and 1 in 12 had three or more.
  statcan.gc.ca/o1/en/plus/5102-glimpse-health-canadians.
- **64% of adults 50+**: AARP 2026 Travel Trends Survey: 64% expect at least one leisure trip
  in 2026. aarp.org/travel/travel-tips/travel-trends-survey-2026.
- **0 of 5**: PlanMyTrip.health review of Google Travel, Tripadvisor, Expedia, Booking.com, and
  Kayak, November 2026.
- **286 tests**: the repository gate at this commit.
- **Calibration tiers and gates**: `docs/ML.md`; no real trip has contributed a label yet.

## Rubric check

| Slide | Title words | Body words | Accent | Result |
| --- | --- | --- | --- | --- |
| 1 Cover | — | 12 | none | PASS. No footer. One personal photograph, provided by the presenter; not stock. |
| 2 Problem | 9 | 33 | the `0` | PASS. Every number sourced in the label. |
| 3 Solution | 9 | 31 | `Pace` | PASS. Three rows, one rule each. |
| 4 Demo | 7 | 19 | `Live` | PASS. Stage cue and fallback. |
| 5 Architecture | 8 | 7 | `not` | PASS. Inline SVG, 1 px boxes, 1.5 px connectors. |
| 6 Comparison | 11 | 11 footnote | one `Yes` | PASS. Table excluded from the body budget. |
| 7 Impact | 7 | 30 | `twelve` | PASS. Three bullets, no sub-bullets. |
| 8 Close | 5 + 6 | 0 | URL | PASS. |
| 9 Appendix | 10 | 13 + table | `1,000+` | PASS. Not presented in the three minutes. |

Banned check: no emoji, no icons, no gradients, shadows, blur, glass, centered text, pill
badges, decorative shapes, purple, marketing filler, agenda or thank-you slide. The only raster
asset is the personal photograph on the cover; it is not stock and not decorative.

## Likely questions

**Is this medical advice?** No. It is a planning aid. Limits are conservative, every profile is
marked `VERIFY`, and the care card tells the traveler to confirm with their clinician and
insurer.

**How is this different from ChatGPT?** ChatGPT plans from memory. We plan from live official
pages, cite each finding with a timestamp, and a deterministic engine owns the daily ceiling.
When a page does not state something, the field says “Not found.”

**What about cancer?** The pitch is general health. Five condition profiles ship today: asthma,
POTS, pregnancy, food allergy, and cardiac. Cancer is next, and its thresholds will not ship
without clinical review. The model is the same: condition, limits, pacing.

**Why TinyFish instead of scrapers?** Real travel and insurance sites are JavaScript-heavy and
change often. TinyFish runs real browsers, streams the live session so the user can watch, and
returns strict JSON. Retries and timeouts keep one slow site from killing the run.

**What if an agent fails?** The itinerary is engine-only and never depends on the agents. A
failed worker is isolated and retried; missing fields print “Not found.” The safety envelope is
already on screen before either team finishes.

**Privacy?** No account, cookie, email, or free text. Capture is opt-in, identified only by a
random local install id, and an unanswered follow-up is excluded from training, never read as a
non-flare. A retention policy and privacy review are still required before charging.

**What is the moat?** A condition-labelled dose and outcome pair. Only this product knows what
dose it prescribed, so the corpus cannot be scraped or bought. The model is a calibration layer
on the engine; synthetic data proves the pipeline, not the risk.

**Business model?** Insurer partnership and travel clinics. The three-minute pitch does not
need it; have the answer ready.

## Photo note

The cover photograph is personal, supplied by the presenter, and used with the family’s
consent. It is the only raster asset in the deck. Do not replace it with stock imagery, apply
filters, or reuse it elsewhere.
