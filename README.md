# dataSec

dataSec is an experimental European urban-safety data explorer built around official public data, transparent methodology and city-local context.

## Current prototype

Two structurally different official sources are live in the data model:

### London
- Metropolitan Police neighbourhoods
- monthly police-recorded street-level crime snapshots
- contemporaneous policing boundaries
- category mix and stored history
- within-city incident-density context

### Madrid
- official municipal neighbourhoods
- Madrid Municipal Police central-dispatch incidents
- official municipal boundaries
- category mix and stored history
- within-city incident-density context

Madrid's source is broader than crime and includes traffic, assistance, public-space and other police responses. dataSec therefore does **not** compare London and Madrid as though both datasets measured the same thing.

## Product features

- city landing pages
- area profiles
- local name search
- explicit address/place lookup through OpenStreetMap Nominatim
- browser geolocation matched against stored PostGIS boundaries
- same-city area comparison
- source links and methodology notes
- stable dataSec area identities, independent of source-local IDs
- automated source-contract, ingestion and data-health workflows

## Data architecture

Official source → contract check → download/API adapter → validation → source-specific normalisation → stable area/metric model → PostgreSQL/PostGIS → read-only public product layer.

Raw London crime points are used during spatial assignment and discarded; the product stores aggregate observations and versioned boundaries rather than mirroring the source warehouse.

## Stack

- Next.js 16.3.6
- React 19.3
- TypeScript
- Supabase / PostgreSQL 17 / PostGIS
- Python ingestion pipelines
- GitHub Actions
- static GitHub Pages build prepared for the public preview

## Run locally

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000`.

Useful checks:

```bash
npm run typecheck
npm run build
npm run check:source
python -m unittest discover -s tests
```

## Deployment note

The GitHub Pages workflow builds the static export successfully. The repository still needs GitHub Pages enabled once under **Settings → Pages → Source: GitHub Actions** before the first public deployment can complete.

## Next development

1. finish the public preview deployment
2. improve city-level exploration and data freshness visibility
3. add a production-suitable geocoder before meaningful traffic/monetisation
4. add a third city only after its source can be represented without pretending unlike datasets are directly comparable
5. add population/footfall denominators where reliable official data exists
6. build a scalable map layer once the analytical model is stable

## Methodology rule

dataSec separates source facts from interpretation. It does not publish a universal “safety score” from unlike police datasets.

See `docs/architecture.md`, `docs/schema.sql` and `docs/validation.md` for the current model.
