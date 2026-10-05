> **SUPERSEDED — 2026-10-05.** This product direction is retained for history only. Do not use it as the current design/product brief. The canonical direction is [Product foundation reset](product-foundation-2026-10-05.md).\n\n# DataSec v2 — Product reset / decision-first direction
Date: 2026-10-03. Status: isolated prototype for user evaluation, not a claim that Europe-wide data is live.

## Why Atlas is not the product
The earlier site started from city metrics and replicated a search/map/dossier pattern across legacy, Atlas, widgets and prototype routes. This missed the user's question: "Should I book here, walk around this part of town, or consider living here, without relying on a neighbourhood's old reputation?" The v2 concept **does not replace production yet**.

## Information architecture
- **Start (/v2):** first-time welcome, choose travelling vs moving, search, honest multi-city catalogue. Data is clearly separated from roadmap.
- **City decision workspace (/v2/explore/[city]):** same search, local place selection and purpose; a reading-first *Panorama* (what is actually observed / what is unknown / next decision), an optional *Mapa*, and a separately controlled *Comparar* tab. Same shared evidence contract as existing API/widget.
- **Saved (/v2/saved):** genuine browser-local shortlist, explicitly not account-synced.
- **Method (/v2/guide):** compact explanation of limitations and policy.
- Deep links preserve city, audience and area. Back/forward functionality and accessibility require browser-device regression checks.
- Legacy routes remain available. Do not merge more design into Atlas. The v2 beta is noindex.

## Five information domains (not five arbitrary score weights)
1. **Recorded incidents.** Verified source-defined offence or dispatch series with exact category mix, period, denominator, spatial precision and publication history. Tourist and resident filters can use DIFFERENT recorded indicators, but cannot equate Madrid police dispatch with UK recorded offences.
2. **Street and micro-area observations.** Only where data is geographically precise enough and legally appropriate. Store geographic grain (point anonymised, section, official neighbourhood, district), location uncertainty and period per observation. No invented "avoid these streets" derived from police approximate points or outdated anecdotal lists. When confidence is insufficient, show 'no defensible street guidance' and optionally link to official city visitor advice.
3. **Urban life.** Transport access, service and medical access, light/public space, accessibility, current built environment and available environmental conditions, only with source-approved geography and dates. Separate from crime.
4. **Place history and change.** Changes to housing/urban fabric and historical context when documented and dated. A formerly troubled or lower-income neighbourhood is not automatically risky today. Do not derive current risk from poverty, ethnic origin, immigration, housing tenure or the existence of informal settlements.
5. **Traveller practicality.** Hotel/destination context, late-arrival public transport availability where supported, official city guidance, shortlists. Affiliate commerce remains clearly separated from evidence and never changes city rankings.

Every displayed claim carries: source URL and authority, territorial grain, observed period, publication date, category definition, notes on missing observations, comparability and a named editorial status: 'observed', 'context', 'not available', or 'pending review'. A source with city-scale data cannot backfill neighbourhood maps. Historic information must not be passed off as current.

## V2 data object direction
- Canonical places: continent > country > urban area > city > district > neighbourhood > *optional verified micro-area/street segment*. A common display place can map to multiple overlapping source geographies with validity dates.
- Raw evidence: source_id, source_revision, observed_start/end, published_at, source_geography_id, geographic_grain, anonymization, accuracy, taxonomy, numerical value/unit/denominator, validation flags.
- Context statements: exact published assertion, jurisdiction, source, observation date, expiry/review date and editorial status. No crowdsourced allegations as verified facts.
- Audience lens: selects clearly named measures and relevant domain ordering, **does not output an unvalidated Europe-wide danger score**.
- Product-facing dossier: identity + coverage grid + verified observations + missing/uncertain slots + actions. The same read contract eventually powers web/PWA/extension/B2B, but legacy metrics cannot be reused to invent new domains.
- Source adapter interface should validate source license, refresh latency, territorial fidelity and categories before city promotion.
- Auto-updating only where licensing and technical contracts allow it. Stage data atomically, display last successful validated run, signal source outage instead of fake fresh data.

## Verified feasibility (2026-10-03)
- **Live:** London (Metropolitan Police observations) and Madrid (Municipal Police dispatch data) in current code. Their indicators are not directly equivalent.
- **Barcelona: source review.** City Guardia Urbana incidents catalogue exists, but category mapping, source update and actual micro-area specificity must be audited before showing conclusions. https://datos.gob.es/es/catalogo/l01080193-incidentes-gestionados-por-la-guardia-urbana-en-la-ciudad-de-barcelona
- **Paris: geography proven, crime lens not established.** 80 administrative-quarter polygons https://opendata.paris.fr/explore/dataset/quartier_paris/ . No unsupported crime colouring.
- **Birmingham/Liverpool: source review.** police.uk provides England/Wales coverage; validate regional months, boundary semantics and locality-specific omissions. https://data.police.uk/data/
- **Manchester: research, explicit blocker.** Police UK's current public changelog says Greater Manchester Police data is unavailable there. Do not treat it like Birmingham. https://data.police.uk/changelog/
- Berlin, Amsterdam, Lisbon, Rome, Athens: catalogue entries only, research required on municipality/country datasets, geographies, licenses and data quality.
- Eurostat city statistics are useful citywide context, not a substitute for neighbourhood/street values. https://ec.europa.eu/eurostat/cache/metadata/EN/urb_esms_ee.htm

City launch gates:
1. Official or contractually licensed geographic boundaries and identities, multilingual place aliases as appropriate.
2. At least one honest area-level indicator with date and meaningful geographic coverage, no fictional uniform Europe's safety score.
3. Country-specific category glossary and accepted omissions.
4. Reproducible ingestion / rollback / legal attribution.
5. Manual local verification with a few known areas and street-level truthfulness test, then enable catalogue 'live'.

## Design translation (tested on workflows, not surface mimicry)
- **Airbnb:** familiar onboarding by intent and one evolving search state. Never infer hotel coordinates from vague listing labels, and no affiliation claims without approvals. A shortlist belongs near the decision.
- **Linear:** one persistent navigation grammar; consistent title/action placement across all views, only the current task receives visual prominence, advanced information is progressive.
- **Citymapper:** prompt the task before showing the entire system; location and context are carried forward, the map is available as a tool, not the entire first-time experience.
- **Our World in Data:** traceable values, named period/units, explicit uncertainty and same-indicator comparisons, not one generic Safety 5/5 badge.
- Independent/indie: distinct editorial personality is welcome, but all real actions must be predictable and accessible. Avoid fake map textures, 3D hero animations and decorative noise.

## Product flows for acceptance
A. A tourist searches a real location, explicitly confirms a geocoded result, reads the neighbourhood's currently available relevant incidents and limitations, compares a second neighbourhood and saves one. If a street cannot be responsibly identified, the app says so.
B. A prospective resident opens an overlooked working-class area, reads the available rate/context and lack of certainty, compares an alternative *on the same source and timeframe*, and sees what urban-life data are available vs absent; no historical reputation-based negative badge.
C. Someone opens Barcelona/Paris before live ingestion: they can see exactly what is under source review but **cannot** get fictional quantitative claims, unsafe labels or dead-end links disguised as live pages.
D. An onboarding visitor must understand the product without knowing percentiles, police boundaries or the current London/Madrid database structure.

V2 implementation gates prior to production replacement: GitHub CI/typecheck/build, device viewport inspections and click-testing, real geocoder service/licensing review, privacy review of query flow and saved preferences, methodology test fixtures, partner legal review. No SEO rollout or affiliate tracking for nonoperational city pages.

## Commercial path
Traffic acquisition: researched place pages only where grounded, useful explanatory articles about context/historical transitions with evidence, then optional hotel-affiliate links from the **traveller's decision**. B2B: data context embedded into travel and relocation services, with disclaimers and source licensing. Premium: shortlist/advanced comparison only if proven valuable. Basic observations, limitations and source citations stay free. No deceptive sponsored placement in the indicator layers.

**Explicitly rejected:** sorting neighbourhoods by poverty or informal housing, misusing approximated UK crime coordinates as incident addresses, declaring safe streets without verified exposure, equating police dispatches to convictions, extrapolating unobserved neighbourhoods, or expanding nominal city count to impress instead of providing coverage.
