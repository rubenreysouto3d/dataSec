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
- interactive basemap with selectable crime-related / theft / violence-property layers

### Madrid
- official municipal neighbourhoods
- Madrid Municipal Police central-dispatch incidents
- official municipal boundaries
- category mix and stored history
- within-city incident-density context
- monthly registered-population context for resident-normalised map layers

Madrid's source is broader than crime and includes traffic, assistance, public-space and other police responses. dataSec therefore does **not** compare London and Madrid as though both datasets measured the same thing.

## Product features

- city landing pages
- area profiles
- local name search
- explicit address/place lookup through OpenStreetMap Nominatim
- browser geolocation matched against stored PostGIS boundaries
- same-city area comparison
- interactive OpenFreeMap/OpenStreetMap city maps with zoom, pan, tooltips and selectable analytical layers
- Madrid resident-normalised alternatives using the matched monthly municipal register
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
- Vercel production deployment
- static GitHub Pages export retained as an optional secondary deployment

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

## Deployment

The public prototype is deployed through Vercel from `main`. GitHub Pages remains paused/manual-only so failed Pages setup cannot create notification noise.

## Next development

1. harden automated publication so validated ingests become atomic/run-scoped
2. add a production-suitable geocoder before meaningful traffic/monetisation
3. improve exposure denominators (visitor/footfall where reliable official data exists)
4. add a third city only after its source can be represented without pretending unlike datasets are directly comparable
5. expand map layers only when their semantics are clear and source-supported

## Methodology rule

dataSec separates source facts from interpretation. It does not publish a universal “safety score” from unlike police datasets.

See `docs/architecture.md`, `docs/schema.sql` and `docs/validation.md` for the current model.
