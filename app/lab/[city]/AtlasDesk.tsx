"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AtlasMap from "./AtlasMap";
import SourceLocationCaveat, { isMadridDispatchLocationCaveat } from "@/components/SourceLocationCaveat";
import { areaDisplayName, cityNames, type CityBoundary, type CityMapMetric, type CitySafetySignal, type CitySlug, type Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";
import { buildVisitorPercentileMap, MAP_COLOR_BANDS } from "@/lib/map-filters";
import { bandNumber, metricForLayer, type MapLayerMetric } from "@/lib/map-view";
import { localeHref, localeTag, tr, type Locale } from "@/lib/i18n";

type Mode = "resident" | "visitor";
type Props = {
  city: CitySlug;
  areas: Neighbourhood[];
  boundaries: CityBoundary[];
  metrics: CityMapMetric[];
  safetySignals: CitySafetySignal[];
  initialAreaId: string | null;
  initialMode: Mode;
  locale: Locale;
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function number(value: number | null, locale: Locale, digits = 1) {
  return value === null || !Number.isFinite(value) ? "—" :
    new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: digits }).format(value);
}
function localBand(percentile: number | null, locale: Locale) {
  if (percentile === null || !Number.isFinite(percentile)) {
    return tr(locale, "No comparable data", "Sin dato comparable");
  }
  if (percentile < .2) return tr(locale, "Lower fifth", "Tramo inferior");
  if (percentile < .4) return tr(locale, "Below the middle", "Por debajo de la zona media");
  if (percentile < .6) return tr(locale, "Middle range", "Zona media");
  if (percentile < .8) return tr(locale, "Above the middle", "Por encima de la zona media");
  return tr(locale, "Upper fifth", "Tramo superior");
}
function evidence(metric: CityMapMetric | undefined, signal: CitySafetySignal | undefined,
  mode: Mode, visitorRank: number | null): MapLayerMetric {
  return metricForLayer(metric, mode === "visitor" ? "visitor-context" : "contextual-overview", signal, visitorRank);
}

export default function AtlasDesk({
  city, areas, boundaries, metrics, safetySignals, initialAreaId, initialMode, locale,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialAreaId);
  const [search, setSearch] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [showMobileList, setShowMobileList] = useState(!initialAreaId);
  const metricById = useMemo(() => new Map(metrics.map((item) => [item.areaId, item])), [metrics]);
  const signalById = useMemo(() => new Map(safetySignals.map((item) => [item.areaId, item])), [safetySignals]);
  const areaById = useMemo(() => new Map(areas.map((item) => [item.id, item])), [areas]);
  const visitorById = useMemo(() => buildVisitorPercentileMap(metrics), [metrics]);
  const values = useMemo(() => new Map(areas.map((item) => [
    item.id,
    evidence(metricById.get(item.id), signalById.get(item.id), mode, visitorById.get(item.id) ?? null).percentile,
  ])), [areas, metricById, signalById, mode, visitorById]);
  const eligible = [...values.values()].filter((value) => value !== null && Number.isFinite(value)).length;
  const selected = selectedId ? areaById.get(selectedId) ?? null : null;
  const selectedMetric = selected ? metricById.get(selected.id) : undefined;
  const selectedSignal = selected ? signalById.get(selected.id) : undefined;
  const primary = selected
    ? evidence(selectedMetric, selectedSignal, mode, visitorById.get(selected.id) ?? null)
    : null;
  const level = primary ? bandNumber(primary.percentile) : null;
  const comparison = comparisonId ? areaById.get(comparisonId) : null;
  const comparisonMetric = comparison ? metricById.get(comparison.id) : undefined;
  const compared = comparison
    ? evidence(comparisonMetric, signalById.get(comparison.id), mode, visitorById.get(comparison.id) ?? null)
    : null;
  const matching = useMemo(() => {
    const term = normalize(search);
    return areas.filter((area) => !term || normalize(areaDisplayName(area)).includes(term))
      .sort((a,b) => areaDisplayName(a).localeCompare(areaDisplayName(b), locale === "es" ? "es" : "en"));
  }, [areas, search, locale]);
  const latest = metrics.reduce((value, item) => item.month > value ? item.month : value, "");
  const source = city === "madrid"
    ? { title: tr(locale, "Madrid municipal police dispatch records", "Incidencias de Policía Municipal de Madrid"),
      url: "https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information",
      kind: tr(locale, "Dispatch incidents; not an official crime count", "Incidencias operativas; no equivalen a delitos acreditados") }
    : { title: tr(locale, "UK Police open data / Metropolitan Police", "Datos abiertos de la Policía británica / Met Police"),
      url: "https://data.police.uk/about/",
      kind: tr(locale, "Police-recorded offences; anonymised approximate locations", "Delitos registrados; ubicaciones anonimizadas y aproximadas") };

  function choose(id: string) {
    setSelectedId(id);
    setComparisonId((old) => old === id ? "" : old);
    setShowMobileList(false);
    setSearch("");
  }

  const measuredValueLabel = mode === "visitor"
    ? tr(locale, "Recorded theft-related events / km²", "Registros de hurtos y robos / km²")
    : city === "madrid"
      ? tr(locale, "Selected personal-harm dispatches / 10k registered residents / month",
        "Incidencias seleccionadas de daño personal / 10.000 empadronados / mes")
      : tr(locale, "Recorded violence + property / 10k residents", "Violencia y propiedad registradas / 10.000 habitantes");

  const actualPeriod = mode === "resident" && city === "madrid" &&
    selectedSignal && selectedSignal.months >= 3 && primary?.value !== null
    ? `${selectedSignal.monthStart} — ${selectedSignal.monthEnd} · ${selectedSignal.months} ${tr(locale, "published months", "meses publicados")}`
    : selectedMetric?.month ?? latest;

  const methodDescription = mode === "visitor"
    ? tr(locale,
      "The colour shows the within-city position for theft and robbery-related recorded incidents per km². There is no visitor denominator.",
      "El color sitúa la concentración registrada de hurtos y robos por km² respecto a esta ciudad. No se dispone de un denominador de visitantes.",
    )
    : city === "madrid"
      ? tr(locale,
        "The colour compares selected police dispatch events related to personal harm per 10,000 registered residents, averaged across available recent published months. The district survey is separate.",
        "El color compara incidencias policiales seleccionadas relacionadas con daño personal por 10.000 empadronados, promediadas sobre los meses recientes disponibles. La encuesta distrital se presenta por separado.",
      )
      : tr(locale,
        "The colour compares recorded violence and property offences per 10,000 residents within London. The population denominator comes from the 2021 Census.",
        "El color compara delitos registrados de violencia y propiedad por 10.000 habitantes dentro de Londres. El denominador de población procede del censo de 2021.",
      );

  return (
    <main className="atlas" id="atlas-main">
      <div className="atlas-lab-strip">
        <span className="atlas-mono">DS / PRODUCT LAB 02</span>
        <span>{tr(locale, "Alternative product experience · preview, not the public homepage",
          "Nueva experiencia de producto · versión de prueba, no la portada pública")}</span>
        <Link href={localeHref(locale, "/")}>{tr(locale, "Current website ↗", "Web actual ↗")}</Link>
      </div>
      <header className="atlas-heading">
        <div>
          <span className="atlas-overline">{tr(locale, "THE CITY, EXPLAINED / NO GUESSWORK", "ENTENDER LA CIUDAD / SIN ADIVINAR")}</span>
          <h1>{tr(locale, "A place is more", "Un lugar es más")}<br/>
            <em>{tr(locale, "than a colour.", "que un color.")}</em></h1>
          <p>{tr(locale,
            "Start with one neighbourhood. See what is recorded, what stands out and what the data cannot tell you.",
            "Empieza por un barrio. Descubre qué se registra, qué destaca y qué no permiten saber los datos.",
          )}</p>
        </div>
        <div className="atlas-city-nav">
          <span className="atlas-mono">{tr(locale, "CITY / DATASET", "CIUDAD / DATOS")}</span>
          <div>
            {(["madrid","london"] as const).map((slug) => (
              <Link key={slug} className={city === slug ? "is-active" : ""}
                href={localeHref(locale, `/lab/${slug}`)}>{cityNames[slug]}{city === slug ? " ↗" : ""}</Link>
            ))}
          </div>
        </div>
      </header>

      <section className="atlas-intent" aria-labelledby="atlas-task-title">
        <div className="atlas-intent-label">
          <span className="atlas-mono">01 / {tr(locale, "YOUR QUESTION", "TU PREGUNTA")}</span>
          <h2 id="atlas-task-title">{tr(locale, "What brings you here?", "¿Qué necesitas saber?")}</h2>
        </div>
        <div className="atlas-mode-buttons" role="group" aria-label={tr(locale, "Explore by purpose", "Explora según tu objetivo")}>
          <button className={mode === "resident" ? "is-active" : ""} aria-pressed={mode === "resident"}
            onClick={() => setMode("resident")} type="button">
            <span>01</span><strong>{tr(locale, "I could live here", "Podría vivir aquí")}</strong>
            <small>{tr(locale, "Recorded incidents in relation to residents", "Incidencias registradas en relación con los residentes")}</small>
          </button>
          <button className={mode === "visitor" ? "is-active" : ""} aria-pressed={mode === "visitor"}
            onClick={() => setMode("visitor")} type="button">
            <span>02</span><strong>{tr(locale, "I'm visiting", "Voy de visita")}</strong>
            <small>{tr(locale, "Recorded theft-category concentration", "Concentración registrada de hurtos y robos")}</small>
          </button>
        </div>
      </section>

      <div className="atlas-workspace">
        <aside className="atlas-directory" aria-label={tr(locale, "Find a neighbourhood", "Busca un barrio")}>
          <button className="atlas-mobile-list-trigger" type="button" aria-expanded={showMobileList}
            onClick={() => setShowMobileList((old) => !old)}>
            {tr(locale, "Choose another place", "Elegir otro lugar")} <span>{showMobileList ? "−" : "+"}</span>
          </button>
          <div className={`atlas-directory-body ${showMobileList ? "mobile-visible" : ""}`}>
            <label className="atlas-mono" htmlFor="atlas-place-search">
              02 / {tr(locale, "FIND A PLACE", "BUSCAR UN LUGAR")}
            </label>
            <input id="atlas-place-search" value={search}
              onChange={(event) => setSearch(event.target.value)} type="search"
              placeholder={tr(locale, "Name or district…", "Barrio o distrito…")}/>
            <div className="atlas-directory-count">
              <strong>{matching.length}</strong>
              <span>{tr(locale, "matching areas", "zonas coincidentes")}</span>
            </div>
            <div className="atlas-place-list">
              {matching.slice(0, 35).map((area) => {
                const score = values.get(area.id) ?? null;
                const band = bandNumber(score);
                return <button type="button" key={area.id} className={selectedId === area.id ? "is-selected" : ""}
                  onClick={() => choose(area.id)} aria-pressed={selectedId === area.id}>
                  <span className="atlas-place-marker" style={{ background: band === null ? "#c4cccc" : MAP_COLOR_BANDS[band-1].color }}>{band ?? "–"}</span>
                  <span className="atlas-place-copy"><strong>{area.name}</strong><small>{area.parentName ?? cityNames[city]}</small></span>
                  <span aria-hidden="true">↗</span>
                </button>;
              })}
              {matching.length > 35 ? <p>{tr(locale, "Refine your search to see more areas.", "Acota la búsqueda para ver más zonas.")}</p> : null}
              {matching.length === 0 ? <p>{tr(locale, "No matching area. Try another name.", "Sin coincidencias. Prueba otro nombre.")}</p> : null}
            </div>
            <div className="atlas-directory-foot">
              <span className="atlas-mono">{tr(locale, "COVERAGE IN THIS VIEW", "COBERTURA DE ESTA VISTA")}</span>
              <strong>{eligible} / {areas.length}</strong>
              <p>{tr(locale, "Places with a comparable recorded value. Grey means missing data, not zero.",
                "Zonas con un valor registrado comparable. Gris significa ausencia de datos, no cero.")}</p>
            </div>
          </div>
        </aside>

        <div className="atlas-story">
          {selected && primary ? (
            <>
              <div className="atlas-place-head">
                <div>
                  <span className="atlas-overline">
                    {cityNames[city]} {selected.parentName ? `/ ${selected.parentName}` : ""} / {tr(locale, "PLACE DOSSIER", "DOSIER DE LUGAR")}
                  </span>
                  <h2>{selected.name}</h2>
                  <p>{tr(locale, "Recorded local context for", "Contexto local registrado para")}{" "}
                    <strong>{mode === "resident" ? tr(locale, "living here", "vivir aquí") : tr(locale, "a short visit", "una visita")}</strong>
                    {" "}· {actualPeriod}</p>
                </div>
                <Link className="atlas-share-link" href={localeHref(locale,
                  `/lab/${city}?area=${encodeURIComponent(selected.id)}&view=${mode}`)}>
                  {tr(locale, "Direct link ↗", "Enlace directo ↗")}
                </Link>
              </div>

              <div className="atlas-content-grid">
                <div className="atlas-evidence">
                  <article className="atlas-lead-evidence">
                    <div className="atlas-card-top">
                      <span className="atlas-mono">03 / {tr(locale, "WHAT IS RECORDED", "QUÉ SE REGISTRA")}</span>
                      <span className="atlas-small-label">{tr(locale, "One indicator / this city only", "Un indicador / solo esta ciudad")}</span>
                    </div>
                    <h3>{localBand(primary.percentile, locale)}</h3>
                    <div className="atlas-value-line">
                      <span className="atlas-gigantic">{number(primary.value, locale)}</span>
                      <span>{measuredValueLabel}</span>
                    </div>
                    <div className="atlas-band-scale" role="img" aria-label={tr(locale,
                      `Local level: ${level === null ? "no data" : `${level} out of 5`}`,
                      `Nivel local: ${level === null ? "sin datos" : `${level} de 5`}`,
                    )}>
                      {MAP_COLOR_BANDS.map((band, index) => (
                        <div key={band.max} className={level === index + 1 ? "is-active" : ""}
                          style={{ "--atlas-band": band.color } as React.CSSProperties}>
                          <i/><small>{index+1}</small>
                        </div>
                      ))}
                    </div>
                    <p className="atlas-no-verdict">{level === null
                      ? tr(locale, "No valid comparison for this area in this view. Do not read missing data as low activity.",
                        "No existe comparación válida para esta zona en esta vista. La ausencia de datos no equivale a poca actividad.")
                      : tr(locale,
                        "This band compares the selected recorded indicator with other areas of the same city. It does not rate anyone's personal safety.",
                        "Este tramo compara el indicador registrado con otras zonas de la misma ciudad. No valora la seguridad personal de nadie.")
                    }</p>
                  </article>

                  <section className="atlas-explain">
                    <span className="atlas-mono">04 / {tr(locale, "READ THE EVIDENCE", "INTERPRETA LOS DATOS")}</span>
                    <h3>{tr(locale, "What's behind this?", "¿De dónde sale?")}</h3>
                    <p>{methodDescription}</p>
                    <div className="atlas-fact-rows">
                      <div><span>{tr(locale, "Relevant recorded events", "Incidencias registradas relevantes")}</span>
                        <strong>{number(primary.count, locale, 0)}</strong></div>
                      <div><span>{tr(locale, "Observed period", "Período observado")}</span>
                        <strong>{actualPeriod}</strong></div>
                      <div><span>{tr(locale, "Areas with comparable data", "Zonas con datos comparables")}</span>
                        <strong>{eligible} / {areas.length}</strong></div>
                    </div>
                    <div className="atlas-second-look">
                      <strong>{tr(locale, "Additional recorded signals", "Otras señales registradas")}</strong>
                      <p>{tr(locale, "Shown separately: never blended into the colour.", "Se muestran por separado: nunca se mezclan en el color.")}</p>
                      <div><span>{tr(locale, "Theft-related / km² · latest source month", "Hurtos y robos / km² · último mes")}</span>
                        <strong>{number(selectedMetric?.theftPerKm2 ?? null, locale)}</strong></div>
                      <div><span>{tr(locale, "Violence + property / km² · latest source month", "Violencia y propiedad / km² · último mes")}</span>
                        <strong>{number(selectedMetric?.violencePropertyPerKm2 ?? null, locale)}</strong></div>
                      {city === "madrid" && selectedSignal?.districtNightSafety !== null &&
                      selectedSignal?.districtNightSafety !== undefined ? (
                        <div><span>{tr(locale, "2025 district night-safety survey / 10 (different geography)", "Encuesta distrital 2025 sobre seguridad nocturna / 10 (otra geografía)")}</span>
                          <strong>{number(selectedSignal.districtNightSafety, locale)} / 10</strong></div>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="atlas-map-column">
                  <AtlasMap city={city} boundaries={boundaries} areas={areas} values={values}
                    selectedId={selectedId} onSelect={choose} locale={locale}/>
                  <div className="atlas-map-context">
                    <strong>{tr(locale, "Why the centre may look intense", "Por qué el centro puede destacar")}</strong>
                    <p>{tr(locale,
                      "Recorded incidents can cluster around transport, commerce and nightlife. We do not have a measured visitor-flow denominator to correct that effect. A dense colour is not a personal-risk estimate.",
                      "Las incidencias pueden concentrarse cerca del transporte, el comercio y el ocio. No disponemos de un denominador medido de afluencia de visitantes para corregir ese efecto. Un color intenso no estima el riesgo personal.",
                    )}</p>
                  </div>
                </div>
              </div>

              {isMadridDispatchLocationCaveat(city, selected.name) ? (
                <div className="atlas-location-caveat"><SourceLocationCaveat locale={locale}/></div>
              ) : null}

              <section className="atlas-compare" aria-labelledby="atlas-compare-title">
                <div>
                  <span className="atlas-mono">05 / {tr(locale, "COMPARE LIKE WITH LIKE", "COMPARA LO COMPARABLE")}</span>
                  <h3 id="atlas-compare-title">{tr(locale, "Put it in context.", "Ponlo en contexto.")}</h3>
                  <p>{tr(locale, "Select another area from this city. Both figures use the same current indicator and view.",
                    "Elige otra zona de esta ciudad. Ambas cifras utilizan el mismo indicador y la misma vista.")}</p>
                </div>
                <div className="atlas-compare-picker">
                  <label htmlFor="atlas-compare-input">{tr(locale, "Second area", "Segunda zona")}</label>
                  <select id="atlas-compare-input" value={comparisonId}
                    onChange={(event) => setComparisonId(event.target.value)}>
                    <option value="">{tr(locale, "Select an area…", "Selecciona una zona…")}</option>
                    {areas.filter((area) => area.id !== selected.id)
                      .slice().sort((a,b) => a.name.localeCompare(b.name))
                      .map((area) => <option value={area.id} key={area.id}>
                        {areaDisplayName(area)}
                      </option>)}
                  </select>
                </div>
                {comparison && compared ? (
                  <div className="atlas-side-by-side">
                    {[
                      { area: selected, item: primary },
                      { area: comparison, item: compared },
                    ].map(({area,item}) => {
                      const n = bandNumber(item.percentile);
                      return <article key={area.id}>
                        <span>{area.name}</span>
                        <strong>{number(item.value, locale)}</strong>
                        <small>{measuredValueLabel}</small>
                        <div className="atlas-comparison-marker"><i style={{ background: n === null ? "#b8c1c2" : MAP_COLOR_BANDS[n-1].color }}/>{n === null ? tr(locale, "No comparison", "Sin comparación") : `${tr(locale, "Local level", "Nivel local")} ${n}/5`}</div>
                      </article>;
                    })}
                    <p>{tr(locale,
                      "Same recorded category and same city; the bands are relative, not a ranking of personal safety.",
                      "Misma categoría registrada y misma ciudad; los tramos son relativos y no clasifican la seguridad personal.",
                    )}</p>
                  </div>
                ) : null}
              </section>

              <div className="atlas-end-actions">
                <Link href={localeHref(locale, areaHref(selected.id))}>
                  {tr(locale, "See the complete official-data profile ↗", "Ver la ficha completa de los datos ↗")}
                </Link>
                <Link href={localeHref(locale, `/city/${city}?view=${mode}&area=${encodeURIComponent(selected.id)}`)}>
                  {tr(locale, "Open full-screen geographic explorer ↗", "Abrir explorador geográfico ↗")}
                </Link>
              </div>
            </>
          ) : (
            <div className="atlas-no-selection">
              <span className="atlas-mono">02 / {tr(locale, "SELECT AN AREA", "SELECCIONA UNA ZONA")}</span>
              <h2>{tr(locale, "Start with a real place.", "Empieza por un lugar real.")}</h2>
              <p>{tr(locale, "Choose a neighbourhood from the list. You'll see the underlying numbers before interpreting the map.",
                "Elige un barrio de la lista. Verás las cifras originales antes de interpretar el mapa.")}</p>
              <AtlasMap city={city} boundaries={boundaries} areas={areas} values={values}
                selectedId={null} onSelect={choose} locale={locale}/>
            </div>
          )}

          <footer className="atlas-provenance">
            <span className="atlas-mono">06 / {tr(locale, "EVIDENCE & LIMITS", "EVIDENCIA Y LÍMITES")}</span>
            <div>
              <strong>{source.title}</strong>
              <p>{source.kind} · {tr(locale, "Latest stored source month", "Último mes almacenado")}: {latest || "—"}.</p>
              <p>{tr(locale,
                "City-specific official source. Resident and Visitor are two different recorded indicators, not a common cross-city safety metric. Location and reporting biases may remain.",
                "Fuente oficial específica de cada ciudad. Residente y Visitante son indicadores registrados distintos, no una medida universal de seguridad entre ciudades. Persisten posibles sesgos de registro y localización.",
              )}</p>
            </div>
            <a href={source.url} rel="noreferrer" target="_blank">{tr(locale, "Original source ↗", "Fuente original ↗")}</a>
            <Link href={localeHref(locale, "/methodology")}>{tr(locale, "Full methodology ↗", "Metodología completa ↗")}</Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
