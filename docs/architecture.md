# dataSec architecture

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
aggregated observations
    ↓
public read-only API / Next.js
```

### London

The interactive prototype can read `data.police.uk` directly.

The persistent pipeline uses the official custom CSV download for one Metropolitan Police month at a time. Raw anonymised points are spatially assigned to current neighbourhood-policing boundaries in memory, then discarded. Only monthly aggregates are persisted.

This prevents the product database from becoming a duplicate warehouse of millions of raw crime rows.

## Geography

`areas` stores stable identities.

`area_boundaries` stores a boundary version by month. A neighbourhood name or polygon may change without losing older observations.

Cross-country comparisons are not permitted merely because two sources both use the word “crime”. Each importer declares what its source actually measures.

## Database exposure

Browser-readable tables are read-only to `anon` and `authenticated` roles and use RLS.

Pipeline diagnostics are writable only by the backend `service_role` and have no browser read policy.

The service-role key must never be shipped to the Next.js client.

## Quality gates

A source update is publishable only when:

- the source contract still matches;
- the requested month exists;
- expected columns are present;
- enough rows are returned to be plausible;
- source categories map to known metrics;
- unmatched spatial rows stay below the source-specific threshold;
- the pipeline completes before marking an ingestion run `passed`.

Failed imports leave the previous good observations intact.
