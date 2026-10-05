> **SUPERSEDED — 2026-10-05.** This product direction is retained for history only. Do not use it as the current design/product brief. The canonical direction is [Product foundation reset](product-foundation-2026-10-05.md).\n\n# DataSec Atlas — product redesign candidate (2026-10-02)

> **Product-direction update, 2026-10-03:** Atlas remains an interaction prototype, not the overarching product strategy. The unified web/PWA/extension/widget user journey and monetisation assumptions are defined in [Unified product strategy](product-strategy-unified-2026-10-03.md). Do not launch Atlas as a separate product or treat its layout as the final experience.\n\n**State:** independent, `noindex` prototype at `/lab/madrid` and `/lab/london`. It does **not** silently replace the current site. This is a new interaction architecture, not a fourth CSS refresh of the existing city explorer.

## The original failure

Adding a list, map, comparison and multiple panels to the existing map made the existing screen busier without answering a person's question. The previous design spec even stipulated "presentation-only." The interface had internally consistent filters but an external user needed to know what a percentile, numerator, denominator and police-recorded event meant *before* getting value.

## One product promise

**Give me a grounded account of the available official data for a specific place, explain its limits, and let me check another place on precisely the same basis.**

The product provides recorded geographic context, **not** a danger score, individual-risk probability, accommodation endorsement, ranking of "good" and "bad" people, or cross-city league table. Do not invent corrections to make red centres aesthetically resemble received reputation.

## Interaction: three questions in a single continuous journey

1. **What is my question?** Choose living in the area or a short visit. This changes the explicitly named observable indicator, not only copy or a hidden weighting.
2. **What place?** Search an official neighbourhood or pick one on the synchronized map. The system immediately opens an information dossier; the map supports the reading rather than swallowing the screen.
3. **What can I verify?** One primary measured value, its geographic within-city position, period, scope, denominator and coverage. Raw secondary values remain separate. Compare another area with the exact same current indicator without switching mental models.

Advanced mapping, all categories, historical trends and more detailed methodology are **second-order** tasks, linked from the same context. The screen must stand on its own without opening those links.

## Translation of the design references

- **Linear**: a unified stable navigation grammar and precisely defined context state (city + purpose + selected area), not Linear's superficial visual treatment.
- **Flighty**: the useful unit is a *place dossier*, with status-like distinctions between what was measured, what is unavailable and what is subject to important caveats. Numbers are never presented without a period and unit.
- **Our World in Data**: single-indicator interpretation, named source and coverage, explicit unknowns and same-measure side-by-side comparisons. Five colours are a projection of the measurement, not a property of a neighbourhood's people.
- **Independent / hacker design**: Atlas is an editorial field instrument, not a generic financial SaaS dashboard: disciplined monospace provenance, oversized place typography, working geographic layers, confident dark/light hierarchy, tactile data bars, restrained motion. Novelty must not add friction.

## Key editorial integrity decisions

- Madrid's official municipal police dispatches are **not** equivalent to the Metropolitan Police's offence recordings.
- Primary Resident is recent selected personal-harm dispatches per 10,000 registered residents per month where valid in Madrid; selected recorded violence/property per 10,000 **2021 Census** residents in London.
- Primary Visitor is recorded theft/robbery-related incident concentration per km², not visitor risk. There is no reliable citywide tourist-footfall denominator aligned to all neighbourhoods.
- The Madrid district-level 2025 perception survey must never change a neighbourhood incident colour and, if displayed, must say explicitly that its geographic unit is different.
- For Guindalera, explain the documented administrative attribution of some 092 requests instead of automatically down-weighting the area or hiding the anomaly.
- Unobserved data is visibly different from measured zero.
- Comparison is within the same city, period and active indicator. No overall "safer" label is generated.

## Required launch gates before replacing existing routes

- [ ] Functional desktop/mobile visual inspection of Madrid and London, not just HTTP 200 and server HTML presence.
- [ ] One end-to-end test: change purpose → search/place selection → read one data card → select second area → compare → retrieve original source.
- [ ] Manual comparison of printed values with the exact stored rows and the current `metricForLayer` logic.
- [ ] Source category check: municipal dispatches must never be described simply as crimes, and London geolocations are approximate.
- [ ] Check that source updates, missing-data paths and fallback basemap failure preserve truthful output.
- [ ] Accessibility: keyboard place selection and comparison, colour-independent information, no hidden mobile source caveat.
- [ ] Decide whether the full-screen legacy map becomes an advanced route after adopting Atlas. Do **not** layer Atlas on top of the old map UI and call that a redesign.

## Product follow-through (separate and testable)

1. **Data trust**: show source availability and period per category and per area; introduce honest insufficient-history states rather than zero-filled assumptions.
2. **End-to-end lodging lookup**: address/hotel resolves to the official boundary with explicit consent for geocoding; the resolved place opens its dossier.
3. **Stable public area-dossier object**: use the same independently tested evidence contract for the full site and future Booking/Airbnb extension; do not copy or reverse engineer presentation strings as data.
4. **Research mode**: advanced source comparison and trends for users who want the underlying details; never force it on a first-time visitor.
5. **Eventual rollout**: user-test prototype, replace main home and neighbourhood route together, retire redundant old views, then adapt SEO/meta.

No unvalidated reputation-based corrections, no fabricated accuracy or footfall adjustment, no metric blending merely to produce an appealing map.
