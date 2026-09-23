# dataSec

dataSec is an experimental European urban-safety data explorer built around official public data, transparent methodology, and city-local comparisons.

## Current prototype

The first vertical is **London / Metropolitan Police** and reads directly from the official `data.police.uk` API:

- Metropolitan Police neighbourhood list
- neighbourhood metadata and boundary
- latest six published months of street-level recorded crime
- crime-category mix
- six-month raw incident trend
- explicit source and methodology limitations

The prototype intentionally **does not** publish a universal safety score. Recorded crime, police incidents, victimisation surveys, population and footfall are different concepts; cross-country normalisation will be added only where the data supports it.

## Stack

- Next.js 16.3.6 (Active LTS security update)
- React 19.3
- TypeScript
- planned persistence: Supabase / PostgreSQL / PostGIS
- deployment: Vercel

## Next milestones

1. persistent ingestion and source-version checks
2. city distributions / percentiles and population context
3. anomaly gates before publication
4. Madrid importer as the second, structurally different source
5. map tiles and address lookup after the data layer is stable

## Data source

London prototype data: https://data.police.uk — Open Government Licence v3.0.
