> **Product-model note (2026-10-05):** This document describes the current technical ingestion architecture. It is not the target product/evidence model. The canonical product direction and migration target are defined in [Product foundation reset](product-foundation-2026-10-05.md).\n\n# dataSec architecture

## Product rule

dataSec separates **source facts** from **interpretation**.

A source observation is never renamed into “safety” merely because it is negative. The first persisted London metric is a count of police-recorded incidents by category, area and month. Relative labels and rates are a later derived layer.

## Data flow

```text
official source
    ↓
source contract check
    ↓
download / API adapter
    ↓
schema + anomaly validation
    ↓
source-specific normalisation
    ↓
stable area + metric model
    ↓
run-scoped staging
    ↓
single transactional publication RPC
    ↓
public read-only API / Next.js
```

### London

The interactive prototype can read `data.police.uk` directly.

The persistent pipeline uses two official resources for the same month:

1. a custom Metropolitan Police street-crime CSV download;
2. the monthly NPT boundary archive from `/data/boundaries/YYYY-MM.zip`.

Each Metropolitan KML file contains the force-specific neighbourhood ID, human-readable name and polygon geometry for that month. Raw anonymised crime points are spatially assigned to those contemporaneous boundaries in memory, then discarded. Only monthly aggregates and the versioned boundaries are persisted.

This avoids hundreds of per-neighbourhood API calls, supports historically correct backfills and prevents the product database from becoming a duplicate warehouse of millions of raw crime rows.

## Geography

`areas` stores stable source identities.

`area_boundaries` stores a boundary version by month. A neighbourhood name or polygon may change without losing older observations. The parser supports multiple polygons and inner rings (holes).

The police neighbourhood geography is a source layer, not necessarily the user-facing place vocabulary. A later place/address layer can map searches such as Soho or a hotel address onto the relevant official area without altering source observations.

Cross-country comparisons are not permitted merely because two sources both use the word “crime”. Each importer declares what its source actually measures.

## Database exposure

Browser-readable tables are read-only to `anon` and `authenticated` roles and use RLS.

Pipeline diagnostics are writable only by the backend `service_role` and have no browser read policy.

The service-role key must never be shipped to the Next.js client.

Scheduled ingestion does not store a Supabase secret in GitHub. GitHub Actions requests a short-lived OIDC token only when publication begins. The `github-ingest` Supabase Edge Function verifies the token issuer, custom audience, repository ID, owner ID, `main` ref and an allow-list of ingestion workflow files before proxying a narrowly allow-listed set of backend writes. The Edge Function keeps Supabase backend credentials inside Supabase itself.

## Quality gates

A source update is publishable only when:

- the source contract still matches;
- the requested month exists;
- expected CSV columns are present;
- the matching monthly boundary archive exists;
- KML IDs agree with their filenames;
- enough rows are returned to be plausible;
- source categories map to known metrics;
- unmatched spatial rows stay below the source-specific threshold;
- the pipeline completes before marking an ingestion run `passed`.

Source-level quality gates run before product rows are staged, so a rejected source snapshot does not publish new observations.

Validated metrics, areas, boundaries and observations are written into an internal run-scoped staging table. The public tables are then updated by one `publish_ingestion_run` database RPC. PostgreSQL executes that RPC transactionally: either the whole validated snapshot becomes public and the run is marked `passed`, or none of the staged product rows are published. Failed staging runs remain isolated from the browser-facing tables and can be diagnosed without exposing partial coverage.

The daily data-health job remains a second line of defence for freshness, latest-month coverage, stable identities and coordinate lookup.


## Place and address lookup

The prototype resolves free-text places in two stages:

1. Search stored official area names locally first.
2. Only after an explicit user action, send one search request to the public OpenStreetMap Nominatim service, then pass the returned coordinate to dataSec's PostGIS `find_area_at_point` RPC.

Constraints:
- no autocomplete or background geocoding;
- direct user-triggered requests only;
- OpenStreetMap attribution is shown next to the lookup;
- the geocoder endpoint is isolated in `lib/public-data-client.ts` so it can be replaced without changing the area model;
- production-scale or monetised traffic must move to a suitable hosted/self-hosted geocoder rather than relying on the public Nominatim capacity.

## Cross-city filter contract

The user-facing map vocabulary is global, not city-specific. Every supported city exposes the same primary modes and advanced filters:

- Resident
- Visitor
- Violence + property
- Theft + robbery
- All crime-related
- All source activity

A city adapter may use a different official source definition or denominator behind a filter when local data is not directly equivalent, but it must preserve the filter's user intent and disclose the city-specific method in the interface.

Resident uses an identifiable official-source recorded category rate per resident rather than treating a survey response as a neighbourhood incident. Visitor uses directly observed theft/robbery-related categories per km², with violence/property shown separately; there is no defensible official visitor-footfall denominator for each neighbourhood. Neither view claims to estimate an individual's probability of victimisation.

City-specific datasets may add evidence to a common mode (for example Madrid resident-perception survey data), but they must not add a city-only public filter. New cities inherit this contract by default.


## Auditable method revision, October 2026

The previous Madrid 50/50 district survey + neighbourhood incident composite and visitor 70/30 category-weighted composite are retired. District perception remains clearly separate 2025 context; current city-relative map colours derive from one observable category series. Refer to `docs/indicator-policy.md` for exact definitions and known source anomalies, including Guindalera's 092 administrative-assignment caveat.
