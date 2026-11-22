# Pitch deck and demo runbook

The judges said the session is a live demo, not a slide deck. That is a tip about priority, not
a ban on a title card. This runbook uses **two frames and then the product for two minutes**.

The deck is a static 1920×1080 artifact in `public/pitch/`, served at
`https://planmytrip.health/pitch` by a rewrite in `next.config.ts`. It is presentation-only: not
an app route, not covered by the design guard, and it adds no application code. **Only slides 1
and 2 are presented.** Slides 3–10 are backup, Q&A, and the leave-behind PDF.

Keys: `→` / `Space` advance, `←` back, `Home` / `End` jump, `F` fullscreen.

## The 2:55 run sheet

| Time | Beat | Where |
| --- | --- | --- |
| 0:00–0:20 | Basil | deck slide 1 |
| 0:20–0:36 | Problem | deck slide 2 |
| 0:36–0:46 | Solution | live app, onboarding |
| 0:46–1:10 | Seven agents | live app, mission band |
| 1:10–1:30 | Three browsers | live app, End to verification |
| 1:30–2:30 | Finished trip | finished window: route, caps, care card, findings |
| 2:30–2:49 | Architecture and impact | spoken over the finished plan |
| 2:49–2:55 | Close | finished plan |

Two frames, one window switch, 114 seconds of live product. No deck after 0:36.

## Script

### 0:00 — slide 1

> Basil loved to travel. He also had cancer. He died in February 2024, at 33. The trips were
> never the problem; planning was. Which day is too long. Is his medication legal at the border.
> Will insurance pay. He did that alone, at two in the morning.

Pause after “33.” Do not perform the grief; state it.

### 0:20 — slide 2

> Basil wasn’t rare. Forty-five percent of Canadians live with a chronic disease. One in twelve
> lives with three or more. Two-thirds of adults over 50 plan a trip this year. No major planner
> asks about any of it.

### 0:36 — switch to the live app

The live window is on the onboarding review step, pre-filled. Say:

> So we built the planner that starts with the body. Two steps in. The engine sets the caps.
> Seven agents plan the trip. Three browsers verify it.

Press **Build my plan** at 0:44.

### 0:46 — mission band

> This is live. Seven agents: stays, tables, trails, culture, transit, care, and a lead
> concierge. The mission band shows the stage, the elapsed time, and how many have finished.
> They’re searching now.

### 1:10 — live verification

Press **End** to reach live verification.

> Three real browsers, live. Canada’s advisory. Drugs.com. Sun Life. Not cached.

The live run will not finish before you leave it. That is expected. It is the proof that the
agents are working on real sites; the finished window is the proof of the whole job.

### 1:30 — switch to the finished window

> Here’s the same trip from earlier, finished.

Route stage:

> The route is ordered by day, with a Maps handoff.

Safety envelope:

> Each day carries the agent’s estimate and the engine’s caps. The agent can suggest a day.
> It cannot lift the cap.

Copy the care card:

> One click: the days, the caps, the checkpoints.

Scroll to verification findings:

> Every finding carries the page and the time we read it.

### 2:30 — architecture and impact

> Two loops. The live loop: seven OpenCode agents plan, the engine sets the caps, three TinyFish
> browsers verify. The learning loop: every consented trip becomes a dossier and an outcome. The
> model learns the residual and may only tighten a cap. Hours of research become seven minutes.

### 2:49 — close

> Basil would have gone anyway. The planning should have been easier.

Stay on the finished plan. Do not return to the deck.

## Runbook

### Windows

- **A — deck.** `https://planmytrip.health/pitch#1`, maximized. Right arrow once at 0:20.
- **B — live app.** Onboarding step 2, pre-filled with the exact demo inputs. Do not press Build
  until 0:44.
- **C — finished app.** A run started at T−25 on the same inputs, finished, scrolled to the
  route stage.
- **D — backups.** The recorded clean run and the PDF. Not a window; open only if needed.

### Before the room

1. Open C at T−25. Complete onboarding, press Build my plan, leave it to finish. Before the
   pitch, scroll to the route stage.
2. Open B. Complete onboarding with the same inputs. Stop on the review step. Do not press
   Build.
3. Open A at slide 1. Maximize both windows; hide bookmarks and notifications. Zoom 90% on the
   app, 1600×1000.
4. Confirm C is finished and scrolled to the route; B is ready; A is on slide 1.
5. Keep D ready.

### The switch

- **0:20:** right arrow to slide 2.
- **0:36:** alt-tab A → B. Press Build at 0:44.
- **1:10:** press End in B to show live verification.
- **1:30:** alt-tab B → C. Say “here’s the same trip from earlier, finished.”
- **2:49:** close on C.

Never refresh B or C. Both remount the workspace and abort the running streams. Never press
Plan again on C. Do not return to A after 0:36.

### Fallback ladder

1. B starts live: the script above.
2. B is slow: talk over the mission band and the agent deck; move to C at 1:10.
3. B fails: switch to C at 0:50 and say “here’s one from earlier.”
4. Network gone: C is already loaded; use it. If C is gone, play the recording.
5. No deck fallback. The deck is not the pitch.

### The 0-of-5 audit

Slide 2 claims 0 of 5 major planners ask about health. Before presenting, open the trip-planning
flow in Google Travel, Tripadvisor, Expedia, Booking.com, and Kayak and screenshot the input
steps. Keep the screenshots in the speaker notes. If any planner asks, change the number and the
source line.

## Q&A and the appendix

If a judge asks about the system, open the relevant slide directly:

- Architecture: `/pitch#5`.
- Comparison: `/pitch#6`.
- The calibration model: `/pitch#9`.
- The data asset: `/pitch#10`.

Do not walk through them; answer the question, show the one slide, then return to the product.
The full deck is also the leave-behind PDF.

## Sources

- **45% and 1 in 12**: Statistics Canada, “A glimpse at the health of Canadians” (2021 data):
  45.1% lived with at least one major chronic disease and 1 in 12 had three or more.
  statcan.gc.ca/o1/en/plus/5102-glimpse-health-canadians.
- **64% of adults 50+**: AARP 2026 Travel Trends Survey: 64% expect at least one leisure trip
  in 2026. aarp.org/travel/travel-tips/travel-trends-survey-2026.
- **0 of 5**: PlanMyTrip.health review of Google Travel, Tripadvisor, Expedia, Booking.com, and
  Kayak, November 2026.
- **466 tests**: the repository gate at this commit.
- **Calibration tiers and gates**: `docs/ML.md`; no real trip has contributed a label yet.

## Rubric check

| Slide | Title words | Body words | Accent | Result |
| --- | --- | --- | --- | --- |
| 1 Cover | — | 12 | none | **Presented.** One personal photograph, provided by the presenter; not stock. |
| 2 Problem | 1 | 33 | the `0` | **Presented.** Every number sourced in the label. |
| 3 Solution | 1 | 31 | `Pace` | Backup; the onboarding screen replaces it. |
| 4 Demo | 1 | 19 | `Live` | Backup; the app is the demo. |
| 5 Architecture | 1 | 7 | `not` | Backup; spoken over the finished plan. |
| 6 Comparison | 1 | 11 footnote | one `Yes` | Backup; one spoken line if needed. |
| 7 Impact | 1 | 24 | `seven` | Backup; spoken over the care card. |
| 8 Close | 5 + 6 | 0 | URL | Backup; spoken over the live plan. |
| 9 Model | 1 | 21 + table | `never` | Q&A appendix; formula, tiers, ship gate. |
| 10 Data | 1 | 10 + tables | `dose` | Q&A appendix; not presented. |

Titles are the presenter’s section names, not assertions. The content carries the takeaway.

Banned check: no emoji, no icons, no gradients, shadows, blur, glass, centered text, pill
badges, decorative shapes, purple, marketing filler, agenda or thank-you slide. No app tabs;
the workspace is one page. The only raster asset is the personal photograph on the cover; it is
not stock and not decorative.

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
returns strict JSON. Each worker is capped at 100 seconds and 60 steps inside a 120-second
route; a blocked site retries once with a stealth profile.

**What if an agent fails?** The itinerary is engine-only and never depends on the agents. A
failed worker is isolated and retried; mission control keeps the failed tile and the retry
visible. Missing fields print “Not found.” The safety envelope is already on screen before
either team finishes.

**Privacy?** No account, cookie, email, or free text. Capture is opt-in, identified only by a
random local install id, and an unanswered follow-up is excluded from training, never read as a
non-flare. A retention policy and privacy review are still required before charging.

**How does the model work?** The engine’s modeled risk is the prior log-odds. The model learns
the residual with penalized logistic regression; standardization, coefficients, and the
isotonic map are fitted inside nested grouped folds. With zero labels the coefficients are zero,
so the model is exactly the engine. It may tighten a cap, never widen one.

**What is the data asset?** A consented, condition-labelled dose and outcome pair. The dose is
computed from plan blocks, never the agent’s self-report; the outcome is an explicit flare
answer. Only this product knows what dose it prescribed, so the corpus cannot be scraped.

**What is the moat?** That dose and outcome pair at scale. The model is a calibration layer on
the engine; synthetic data proves the pipeline, not the risk.

**Business model?** Insurer partnership and travel clinics. The live demo does not need it;
have the answer ready.

## Photo note

The cover photograph is personal, supplied by the presenter, and used with the family’s
consent. It is the only raster asset in the deck. Do not replace it with stock imagery, apply
filters, or reuse it elsewhere.
