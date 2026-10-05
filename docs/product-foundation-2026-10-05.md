# DataSec — Product foundation reset
**Date:** 2026-10-05  
**Status:** canonical product direction. This document supersedes earlier Atlas / decision-first / compare-first product directions.  
**Rule:** no further visual redesign should be treated as product progress unless it is driven by the contracts below.

## 1. Why the current product fails

DataSec has been designed from the data outward. We had neighbourhood crime/dispatch aggregates, so the interface became a neighbourhood crime map. We then added visitor/resident modes, comparison, city pulse, layers, nearby POIs and street points around that same centre of gravity.

That produces a technically busy product but not a professional tool.

The real user does not arrive asking:

> "What percentile is this administrative area?"

They ask things like:

- I am thinking of booking this hotel. What should I know before I pay?
- My flight arrives late. Is the walk from the station to the hotel sensible at midnight?
- I am standing here now. What nearby places deserve more attention?
- Is this street lively or deserted after shops close?
- Is this area noisy every night or only busy in the daytime?
- If I live here, what does ordinary life look like?
- Can I get home reliably late?
- Are daily services, healthcare, schools and parks realistically accessible?
- Is the neighbourhood changing, or am I reacting to an old reputation?
- Which statements are based on current evidence, and which things simply are not known?

The product must be rebuilt around those questions.

## 2. Product definition

**DataSec is an urban-context instrument for an exact place.**

Its job is to help a person understand an unfamiliar place before going there, while they are there, or before deciding to live there.

It is not primarily:

- a crime dashboard;
- a neighbourhood ranking;
- a generic city guide;
- a comparison site;
- a map with a safety colour;
- a universal score;
- an SEO directory with an app attached.

### Core question

> **What is this place actually like for what I am about to do, and what deserves my attention?**

The word "place" means an exact address/POI/current location first, with the surrounding street, walkable area and administrative geographies used as evidence layers.

## 3. Users and situations

There are two broad audiences, but the interface must react to **situation**, not merely switch one score between "visitor" and "resident".

### Visitor
Relevant stages:

1. **Choosing** — hotel/apartment/address before booking.
2. **Arriving** — airport/station -> accommodation, often with luggage and sometimes late.
3. **Here now** — walking around an unfamiliar area.
4. **Tonight** — night transport, activity, noise, closing-time changes and recent/historical safety patterns.
5. **Exploring** — choosing where to spend time without already knowing an address.

### New / prospective resident
Relevant stages:

1. **Screening an address or neighbourhood.**
2. **Testing ordinary daily life.**
3. **Testing late-night / weekend life.**
4. **Testing family needs or other personal priorities.**
5. **Watching how the area is changing over time.**

The same person can move between these situations without leaving the selected place.

## 4. Five primary jobs

These are the product's primary jobs. Everything else is secondary.

### Job 1 — Locate the real place
Search address, hotel, venue, street, postcode, neighbourhood, or use current location.

The result must resolve to:
- an anchor point;
- human place name;
- relevant administrative geographies;
- available evidence grains;
- source coverage at that point.

### Job 2 — Tell me what matters here
The first read is not a score. It is a short set of defensible findings, ordered for the user's current situation.

Example shape:
- **Pay attention to phone/bag around X and Y** — repeated theft/robbery concentration in recent published police data.
- **Late arrival is practical** — night service within a real walking journey, with current/planned service status where supported.
- **Expect a noisy night environment** — measured/modelled noise or strong nightlife/activity evidence, with source and time basis.
- **We cannot assess street-level incident patterns here** — source only reaches neighbourhood level.

Every finding answers "so what?" without pretending certainty.

### Job 3 — Let me inspect the evidence spatially
The map is a manipulable evidence surface:
- tap a hotspot;
- tap a street/area;
- change time/context lens;
- inspect a route;
- turn a domain on/off;
- see the geographic precision of the evidence.

The map must never imply finer accuracy than the source.

### Job 4 — Test a route or daily movement
The natural unit of risk/practicality is often not a neighbourhood but a movement:
- station -> hotel;
- hotel -> venue;
- home -> work;
- home -> school;
- home -> night transport.

A future route layer must intersect the route with evidence and services rather than simply rate its endpoints.

### Job 5 — Save a place and return to it
Saving is useful because unfamiliar-place decisions happen over days or weeks.

Comparison is **not** a top-level job. It becomes contextual only after the user has saved or opened more than one place.

## 5. The main product object

The current system is area-centric. The new system is **Place Context** centric.

A Place Context is generated around an anchor point and contains:

- identity;
- anchor coordinate;
- relevant street / named place;
- overlapping source geographies;
- situation/lens;
- time context;
- available capabilities;
- ordered findings;
- domain evidence;
- nearby practical places;
- optional routes;
- data freshness;
- limitations.

A neighbourhood is evidence attached to the place, not the product itself.

### Product-facing contract

Conceptually:

```ts
type PlaceContext = {
  place: {
    id: string;
    label: string;
    coordinate: Point;
    city: string;
    geographies: GeographyRef[];
  };
  lens: PlaceLens;
  time: TimeContext;
  capabilities: Capability[];
  findings: Finding[];
  domains: DomainEvidence[];
  nearby: PracticalPlace[];
  routes?: RouteContext[];
  coverage: CoverageSummary;
};
```

### Finding contract

```ts
type Finding = {
  id: string;
  domain: Domain;
  importance: "info" | "notice" | "attention" | "official-alert";
  statement: string;
  implication?: string;
  geography: GeographyRef;
  observedPeriod: TimeRange;
  freshness: Freshness;
  confidence: EvidenceConfidence;
  evidence: EvidenceRef[];
  methodVersion: string;
};
```

Findings are generated from versioned rules/templates and source evidence. They must not be free-form LLM assertions.

## 6. Situation lenses

Do not build a single hidden weighting score.

A lens changes **what is prioritised and what is available**, while preserving the underlying evidence.

Initial lenses:

- **Choosing a stay**
- **Arriving late**
- **Around me**
- **Tonight**
- **Living here**
- **Living here with family**

Advanced users may pin priorities such as:
- quiet;
- late transport;
- children;
- parks;
- car/parking;
- healthcare;
- nightlife;
- cycling;
- commute destination.

Priorities change ordering and relevance, not the truth value of source data.

## 7. Information model: four levels

### Level 1 — What I need to understand immediately
Maximum three to five findings:
- what deserves attention;
- strongest positive/practical feature;
- biggest uncertainty;
- current official disruption/alert if one exists.

### Level 2 — What I need to make the decision
Domain strips / sections with direct interpretation:
- personal/property incidents;
- street disorder/drugs;
- after-dark context;
- mobility / late transport;
- noise/activity;
- daily services;
- healthcare;
- education/childcare;
- parks/green;
- air/environment;
- housing context when a defensible source exists.

### Level 3 — Evidence and change
- raw rate/count;
- denominator;
- comparison basis;
- trend;
- time distribution;
- geography;
- source;
- source caveats.

### Level 4 — Advanced
- taxonomy;
- methodology version;
- ingestion run;
- coverage diagnostics;
- source revision;
- raw/open-data link.

The interface should feel dense but calm because only the current level is visually dominant.

## 8. Visitor information that is actually useful

### Before booking
Need:
- exact place, not just named neighbourhood;
- recent theft/robbery pattern;
- violence/disorder/drugs as separate signals;
- whether the source is street-, small-area- or neighbourhood-grain;
- night transport access;
- practical arrival path;
- activity/noise at relevant hours;
- tourist intensity / busy-zone context where a defensible proxy exists;
- hospital/urgent care/pharmacy;
- official local advisories where spatially relevant;
- uncertainty.

Do **not** say "safe hotel" or "safe street".

### On arrival / in the street
Prioritise:
- current position;
- nearby repeated patterns, clearly historic/recent rather than live;
- live official transport disruption;
- open pharmacy / urgent care;
- route to destination;
- official current closures/alerts;
- nearest useful transport;
- quick "what should I pay attention to here?" language.

### At night
If the city supports it:
- incident pattern by time/day;
- night transport service;
- nightlife density / late opening;
- modelled/measured night noise;
- known service disruption;
- areas becoming substantially emptier/busier after certain hours.

If not supported, the UI says that the time-specific evidence does not exist.

## 9. Resident information that is actually useful

A resident view cannot be "crime per resident plus supermarkets".

It needs an ordinary-life picture:

### Safety / public realm
- recent incident trends;
- personal/property categories separately;
- disorder/drugs;
- day/night split where available;
- source coverage and reporting limitations.

### Movement
- transit access;
- service frequency/reliability where available;
- night service;
- realistic walking access to stops;
- cycling;
- car/parking context where defensible.

### Daily life
- supermarkets / everyday shopping;
- pharmacy;
- primary/urgent healthcare;
- green space / playground;
- schools / childcare;
- public services.

### Environment
- noise;
- air quality;
- heat/flooding only when source geography supports it;
- traffic exposure.

### Housing / neighbourhood change
- rent/price only from a legally usable and sufficiently granular source;
- housing mix / urban change as context, not safety proxy;
- development/planning where useful;
- trend over time.

### Family lens
Family relevance must reorder:
- schools/childcare;
- playground/parks;
- health;
- traffic/noise;
- late-evening street context;
- daily logistics.

## 10. Safety language policy

### No universal safety score
A single number destroys source meaning and creates false precision.

### No demographic safety proxies
Do not use income, ethnicity, immigration, tenure, deprivation, social housing or similar variables to infer danger.

Those variables may be shown as independent socioeconomic context if relevant and lawful, but never feed safety findings.

### "Avoid" is a high bar
DataSec may use language equivalent to **avoid** only when supported by:
- an official current restriction/warning; or
- an explicitly reviewed product rule backed by multiple independent, sufficiently local and current sources.

A high monthly incident count alone cannot generate "do not enter".

Normal historic patterns should produce wording such as:
- "more recorded theft concentration";
- "repeated disorder signal";
- "pay extra attention to belongings";
- "street-level evidence unavailable";
- "this is a busy tourist/nightlife area and counts are not exposure-adjusted".

### Historical reputation is not evidence
If the product eventually includes reputation/history, it must be clearly separated and dated. A formerly rough working-class area cannot inherit a current warning from old reputation.

## 11. Data architecture reset

The present database is a good ingestion experiment but is too area/metric-centric for the final product.

Keep its atomic publication and validation ideas, but introduce four explicit layers.

### Layer A — Raw source snapshots
Immutable source material / snapshot metadata:
- source;
- URL/resource ID;
- fetched_at;
- source version;
- checksum;
- licence;
- HTTP metadata;
- publication date;
- coverage period;
- raw asset location;
- validation status.

Large raw files belong in object storage, not product tables.

### Layer B — Normalised evidence
Canonical factual data without interpretation.

#### Geography
Support:
- point;
- approximate point;
- street segment;
- route segment;
- grid cell;
- neighbourhood;
- district;
- ward/LSOA;
- city.

Fields include:
- geometry;
- source geography ID;
- validity period;
- spatial precision / uncertainty;
- parent relationships.

Use a spatial index such as H3 or an equivalent only as a derived indexing layer; never pretend the cell itself is the source geography.

#### Observation / event
Fields include:
- source;
- raw category;
- canonical category;
- observed start/end;
- time-of-day when available;
- published_at;
- geography;
- spatial precision;
- value;
- unit;
- denominator;
- source record/snapshot;
- quality flags.

#### Practical place
Normalise authoritative city registries and supplementary OSM POIs separately:
- type;
- location;
- opening data;
- authoritative/supplementary source;
- last verified;
- completeness note.

#### Transport
Store or proxy:
- stops;
- lines;
- service windows;
- planned/current disruptions;
- accessibility;
- night-service status;
- journey results where licence/API terms allow.

### Layer C — Versioned indicators
Derived facts:
- theft concentration;
- violence rate;
- disorder pattern;
- recent trend;
- time-of-day pattern;
- night transport access;
- service access;
- noise exposure;
- air exposure;
- etc.

Every indicator declares:
- method_version;
- numerator;
- denominator;
- time window;
- source set;
- geography;
- comparability group;
- missingness rules.

### Layer D — Findings
A product interpretation with traceable evidence.

No UI should invent an interpretation from a raw percentile ad hoc. The rule that turns evidence into "pay extra attention to belongings" must be versioned and testable.

## 12. Evidence confidence

Do not hide quality in backend logs.

Each finding should carry a structured confidence object derived from:

- authority quality;
- spatial precision;
- temporal recency;
- temporal completeness;
- category fit;
- denominator quality;
- cross-source corroboration;
- known source anomalies.

User-facing presentation can collapse this to:
- **strong evidence**;
- **useful but limited**;
- **weak / contextual only**;

with a short reason.

This is not a score of danger. It is confidence in the statement.

## 13. City capability manifest

The UI must not hard-code "Madrid does X, London does Y" across components.

Each city publishes a capability manifest:

```ts
type CityCapability = {
  domain: Domain;
  operation: "area" | "street" | "time-of-day" | "live" | "route";
  available: boolean;
  geography: GeographyType[];
  freshness: string;
  sourceIds: string[];
  notes?: string;
};
```

Examples:
- London: approximate street crime = yes; crime time-of-day = no.
- Madrid: neighbourhood police dispatch + hour = yes once the existing hour field is preserved; street crime = no.
- London: live transport/disruption = feasible via TfL.
- Madrid: official EMT stop/service data = feasible; exact live capability must be audited before claiming it.
- Madrid: official noise/air/education/health data = feasible with different spatial/temporal precision.

The interface is generated from capabilities, so adding a city means adding source adapters and a manifest rather than branching the React UI.

## 14. Current data gaps discovered in this audit

### Current schema
The production DB mainly contains:
- cities;
- administrative/policing areas;
- monthly observations;
- boundaries;
- population;
- Madrid commercial activity;
- source/run/quality metadata.

It does **not** yet have first-class models for:
- exact places;
- street segments;
- persisted street evidence;
- routes;
- time-of-day observations;
- live alerts;
- practical-place registries;
- transport service;
- noise/air evidence;
- findings;
- claim-level confidence;
- city capability declarations.

### Current code
Current visitor/resident behaviour is largely a city-wide choice between a small number of safety indicators.

Madrid's official dispatch source contains **Hora de creación**, but the current ingestion aggregates only area + category, discarding the time dimension.

Nearby services currently come from volunteer-maintained OSM and are measured by straight-line distance, not walking journey. That is useful as a fallback, not a professional service-access model.

London street context is queried live but is not yet part of a persisted/versioned evidence model.

## 15. Source roadmap already feasible

This is a feasibility list, not a promise that the source is already integrated.

### Madrid
Already / immediately auditable:
- Municipal Police dispatch incidents: neighbourhood + date + hour + category, monthly.
- Registered population by neighbourhood.
- Commercial activity.

High-value official additions:
- District/neighbourhood indicator panel: housing, health, education, environment, quality of life and other territorial variables.
- EMT stop/route/service datasets.
- Daily and historical acoustic pollution monitoring.
- Real-time + historical air-quality monitoring.
- Official education centres, including childcare/schools.
- Official healthcare centres.
- Pharmacies on duty.
- Municipal facilities / services.

### London
Already / immediately auditable:
- Police.UK approximate street-level crime points.
- Metropolitan Police monthly geography/category series.
- Census population.

High-value official additions:
- TfL Unified API for stop, journey, status, disruption and night-service context.
- London Area Profiles / current ward-level context.
- London/DEFRA road/rail noise mapping.
- GLA air-quality datasets.
- education/school datasets subject to freshness audit.
- green infrastructure / public-space datasets subject to licence and freshness audit.

For both cities, authoritative sources should be preferred for regulated/public services; OSM remains supplementary.

## 16. Public web vs application

They are related but not the same surface.

### Public web
Purpose:
- acquisition;
- indexable city/place context where evidence supports it;
- explain coverage;
- methodology and sources;
- useful editorial/context pages.

It should not imitate the app and should not publish thousands of thin "safe neighbourhood" pages.

### Application / PWA
Purpose:
- search;
- current location;
- temporal/situation lens;
- map manipulation;
- route/place investigation;
- saved places;
- repeated use.

Geolocation is never required for the public web.

## 17. Privacy

Exact location is sensitive product data even if the user voluntarily grants browser geolocation.

Rules:
- process current position transiently by default;
- do not log raw coordinates to analytics;
- quantise coordinates before external APIs where practical;
- saved places require explicit user action;
- make local-only storage possible for saved/private places;
- separate operational logs from user query data;
- document every third party receiving coordinates.

## 18. Information architecture

### App entry
No marketing hero.

Primary surface:
- universal place search;
- **use my location**;
- recent/saved places if any;
- coverage indicator.

One short control asks the situation:
- choosing a stay;
- arriving/around me;
- living here.

The selected place remains persistent while the lens changes.

### Place workspace
One continuous workspace, not five pages.

Persistent:
- place identity;
- map;
- situation/time;
- search/change-place;
- top findings.

Contextual:
- relevant domain evidence;
- routes;
- services;
- sources.

Advanced:
- methodology and raw evidence.

### Explore
Explore exists only when there is no place yet.

It answers a question:
- quieter at night;
- better late transport;
- more green space;
- less theft concentration;
- etc.

It should not open with a generic red/green "good/bad" map.

### Compare
No global Compare tab.

When two saved/open places exist:
- offer "Compare these places";
- compare domain-by-domain only where the same measure is compatible;
- never create an overall winner.

## 19. Signature interaction

DataSec needs one interaction idea that belongs to this product.

The proposed interaction is the **Context Lens**:

The user stays on the same place and changes:
- situation;
- time;
- priorities.

The map, findings and evidence recompose in place.

Examples:
- "Choosing a stay" -> theft, arrival, night transport, noise, practical services.
- "Tonight" -> current transport status, night service, recent street patterns, open pharmacy, late activity.
- "Living here + family" -> schools/childcare, parks, health, noise/traffic, daily transport, safety trend.

A transition between lenses should visibly preserve the place while explaining what changed. This is functional motion, not decoration.

## 20. Visual / interaction direction

The visual system comes after the behaviour above.

Required qualities:
- high information density with low perceived complexity;
- strong hierarchy;
- no generic dashboard grid;
- no endless cards;
- no "green = safe / red = dangerous" default;
- map as evidence surface, not decorative hero;
- typography with editorial authority;
- compact provenance;
- clear states for measured / contextual / unknown / live;
- distinctive spatial transitions when changing lens or drilling into evidence;
- keyboard/search/command access for repeat users.

### Desktop
Can support map + inspector as one workspace, but the inspector is contextual and collapsible.

### Mobile
Must be designed independently:
- location/search at thumb reach;
- map + draggable context sheet;
- current top finding visible without scrolling;
- quick situation/time change;
- route/live actions prioritised;
- advanced evidence one gesture deeper.

Do not shrink desktop sidebar UI into a phone.

## 21. 20-minute usage test

A professional design must support this without mental-model resets:

1. User opens DataSec.
2. Searches a hotel.
3. Confirms exact place.
4. Sees three useful findings and one uncertainty.
5. Switches to "arriving late".
6. Sees night transport / arrival context and what is not known.
7. Opens one street pattern on the map.
8. Checks source and date without leaving the place.
9. Saves the place.
10. Searches another accommodation.
11. Saves it.
12. A contextual compare action appears.
13. User compares only compatible dimensions.
14. Later, while travelling, opens the saved hotel.
15. Switches to "around me".
16. Grants location.
17. Sees nearby recent/historic patterns, current transport issues and essential services.
18. Opens a route to a destination.
19. Returns to the same place without losing state.
20. On a later visit, the app remembers saved places/priorities without forcing onboarding again.

If the product cannot support this coherently, visual polish is premature.

## 22. Things to remove or demote from the current direction

Remove as product pillars:
- Compare as a primary navigation item.
- Generic city pulse as the first thing the app says.
- One visitor score / one resident score.
- Red-green city map as default interpretation.
- "activity" merely because hostelry count exists.
- percentiles as user-facing conclusions.
- straight-line POI distance presented as real accessibility.
- per-city UI branches deciding product semantics.
- large methodology copy in the decision path.
- repeated cards for every metric.
- treating all unavailable domains as empty widgets.

Keep but reposition:
- map;
- search;
- geolocation;
- saved places;
- source provenance;
- versioned ingestion;
- quality gates;
- London street evidence;
- Madrid area evidence.

## 23. Implementation order

### Phase 0 — freeze feature accretion
Do not add more UI concepts to the current explorer.

### Phase 1 — evidence foundation
1. Introduce geography/evidence/capability/finding contracts.
2. Preserve Madrid time-of-day instead of aggregating it away.
3. Move London street evidence into a versioned/persistable model or stable derived cache.
4. Create source-capability manifests.
5. Build confidence/coverage semantics.
6. Add authoritative service-source adapters beginning with the highest-value domains.

### Phase 2 — one vertical slice
Build **one exact place in London** and **one exact place in Madrid** through the new read model.

The API response should be useful before any final UI exists.

### Phase 3 — new application interaction
Build the Place Workspace and Context Lens against that read contract.

Do not port current React sections one by one.

### Phase 4 — mobility and environment
Add transport, night transport, noise, air and service access where defensible.

### Phase 5 — resident depth
Add family/daily-life domains, housing context and neighbourhood change from audited sources.

### Phase 6 — public web
Rebuild indexable pages from the same evidence/finding model.

### Phase 7 — distribution
PWA, extension and widget consume the exact same Place Context contract.

## 24. Acceptance gates

A new product version cannot replace the current app until:

1. A first-time visitor can understand the selected place without knowing police geographies, percentiles or DataSec terminology.
2. The first screen answers where they are, what matters and what they can do next.
3. A resident gets materially different useful information from a visitor, not a renamed metric.
4. Every finding is traceable to source evidence and a method version.
5. Missing data is obvious and never rendered as low risk.
6. Geography shown matches source precision.
7. Time-specific claims exist only where time-specific evidence exists.
8. A live label exists only for live/near-real-time sources.
9. No demographic variable can change a safety finding.
10. "Avoid" requires official alert or explicit multi-source reviewed policy.
11. Desktop and mobile use different arrangements where appropriate.
12. Comparison is contextual, not the organising principle.
13. The product survives source failure gracefully.
14. The interface passes keyboard, contrast and touch-target checks.
15. The user can use it for 20 minutes without being sent through disconnected mini-products.

## 25. Canonical product rule

**Do not build the interface around what happens to exist in a source table.**

Build the user model first. Then:
1. identify the evidence needed;
2. acquire and validate it;
3. express uncertainty;
4. derive a traceable finding;
5. decide where and when that finding deserves attention;
6. only then design its visual representation.
