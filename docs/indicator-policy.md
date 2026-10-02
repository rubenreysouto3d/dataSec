# DataSec indicator contract (2026-10-02)

This is the implementation contract for all interfaces: city maps, search results, area profiles, audience pages, comparisons and embeddable widgets. It also explains where the data **does not** answer an individual safety question.

## What the colour represents

Each coloured neighbourhood has a rank **within the same city** for one identifiable recorded indicator. Five bands are display buckets, not five degrees of personal danger. Grey means a value is unavailable, never "low".

### Resident (default)

- **Madrid:** selected categories of Municipal Police central-dispatch incidents related to threats, assaults, violent robbery and domestic/gender violence. The categories are explicitly allowlisted in `data/sources/madrid-personal-harm-categories.json` and consumed by `lib/data.ts` and CI source-health tests; newly introduced source categories cannot silently enter the signal. Use the **average per available published month across the latest six-calendar-month window**, divided by the number of registered residents and multiplied by 10,000. Require at least three months with published relevant observations. Rank those measured rates only among valid Madrid neighbourhoods.
- **London:** selected police-recorded violence/property categories in the most recent stored month, divided by population using the **2021 Census** and multiplied by 10,000. Rank only among eligible London Metropolitan Police neighbourhoods. The population reference date is older than the crime data.
- In either city, if a neighbourhood lacks a valid resident denominator, the primary Resident view must say **no resident comparison available**. Never silently switch that one area to incidents per km² inside the same comparison.
- **Madrid survey context is separate:** a 2025 municipal survey asks respondents about their sense of safety in their own neighbourhood/area at night and reports results aggregated **by district**. It is context shown alongside the registered incidents, not a weighting input to the neighbourhood colour. The district survey is not a neighbourhood observation and not a probability.
- The old composite that averaged 50% recent recorded-harm percentile and 50% district perception percentile has been retired. Its weighting had no published validation.

### Visitor (default)

- **Madrid:** latest-month theft, robbery, forced-entry robbery and vehicle-related categories from police-dispatch records per km², as defined by the city's stored category view.
- **London:** latest-month police-recorded theft-from-person, other theft, shoplifting, bicycle theft, vehicle crime and robbery per km².
- This is one direct observable **category concentration**; it is not "visitor exposure" or a visitor's risk. Without a defensible official visitor population/footfall denominator, it is not possible to convert incident density into an individual visitor rate.
- The old 70% theft / 30% violence-property composite has been retired; users can still inspect violence/property independently. The categories are not identical in the two cities even when the interface language is aligned.

## Geographic and source anomalies

- **Guindalera (Madrid):** the official source expressly documents that some requests closed as citizen information are administratively associated with the 092 service address there, regardless of the true origin. This can inflate *total source activity*. Crime-related projections explicitly exclude administrative categories, but exclusion does not guarantee an unbiased local crime picture. Surface this caveat on Guindalera's map selection and full profile; do not automatically colour this area green or remove it from the data.
- Central areas in both cities may show high concentration because of visitor numbers, transport and nightlife. Those explanations are *plausible context* and are not a measured footfall correction. No centre-specific numerical "safety adjustment" is allowed without an appropriate exposure dataset.
- Published London crime locations are anonymised and approximate and can shift between nearest anonymous map points and policing boundaries.

## Sources, dates and definitions

- Madrid central police dispatch source, monthly: https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information
- Madrid official 2025 survey, "percepción de seguridad en el barrio o zona donde vive, por distrito", PDF **page 81**: https://www.madrid.es/UnidadesDescentralizadas/Calidad/Observatorio_Ciudad/06_S_Percepcion/EncuestasCalidad/EncuestaMadrides/ficheros/2025/Informe_Res_2025.pdf#page=81
- London location anonymisation: https://data.police.uk/about/

## Acceptance and audit gates

1. No page or widget describes either colour as likelihood of a crime or a universal "safety score".
2. The audience pages, maps, profiles, comparison view and embed rely on the **same** implementation functions `metricForLayer` and `buildVisitorPercentileMap`.
3. The Guindalera caveat displays next to the selected facts and links to the official municipal statement. It is not buried in a backend data-quality log.
4. Missing incident observations and missing denominators are distinguishable from a measured zero.
5. New dispatch categories are excluded from Madrid's personal-harm signal until they are reviewed by name and the contract is updated.
6. Source freshness and period labels always refer to the actual available month(s), not assumed uninterrupted history.
7. Any proposed footfall-adjusted rates require independently verified, aligned source geography and time window before publication. No speculative centre corrections.
8. Any further change to the primary indicator requires a method changelog entry, fixture tests and publication checks before merge.
