# DataSec interface direction

Updated: 2026-10-01

## Product promise

Help someone understand the available *official local records* for a neighbourhood before they stay there or consider living there. DataSec supplies context; it does not predict personal safety or convert heterogeneous city sources into one cross-city score.

## Design influences and how we use them

- **Linear — hierarchy and interface grammar.** Consistent navigation, stable controls and visual restraint. Secondary tools recede; city, chosen audience, indicator and map retain priority. Inspired by Linear's March 2026 design refresh; not a visual copy.
- **Flighty — contextual information.** Show the city's recorded month, make the current Resident/Visitor choice persistent and present the selected neighbourhood as an actionable, readable card. Important caveats appear where the decision is made, not only on a distant legal page.
- **Our World in Data — explainable visualization.** The legend must be immediately interpretable. Keep data provenance, metric definition, local comparability, units and coverage discoverable. Do not conflate a percentile with a probability or assert misleading equivalences.
- **Unseen / Locomotive — personality only.** Controlled motion and distinctive typography are optional polish, never core interaction. Respect reduced-motion preferences.

## Home

1. One user-facing proposition and a short interpretation notice.
2. Choose Madrid or London. Each city shows the actual number of covered areas and latest available source month.
3. Enter the same map via **Resident** or **Visitor**; never send the user into a different navigation scheme.
4. Show the actual five map colours (green to red), with explicit **city-relative** wording.
5. Keep data verification date and methodology one click away.

## City explorer

1. City identity + *latest recorded month* first.
2. Consistent audience controls and consistent advanced metric control across both cities; disable unavailable normalizations rather than faking data.
3. Searching a location and clicking a map zone remain the primary tasks.
4. Selected-area card shows relative level and the underlying observable data. Technical metric definition is accessible on demand.
5. Colour is supplemented by level 1–5; absent data must not be confused with low levels.
6. Methodology and important limitations remain linked and legible on mobile.

## Integrity / QA rules

- Five colour stops come from `MAP_COLOR_BANDS` in `lib/map-filters.ts`. Keep the homepage and CSS swatches synchronized with those exact values.
- Preserve established API, ingestion workflows, canonical routes, queries and source meaning; this work is presentation-only.
- Keep Spanish/English parity for newly added UI copy.
- Test mobile 360px and desktop 1440px: city switch, both audience views, advanced filters, search, selected-area details, help disclosure and source links.
- Run `npm run typecheck`, `npm run build` and linked CI before releasing. Treat Vercel preview deployment as separate from production.
