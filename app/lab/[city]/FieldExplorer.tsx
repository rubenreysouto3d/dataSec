"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AtlasMap from "./AtlasMap";
import SourceLocationCaveat, { isMadridDispatchLocationCaveat } from "@/components/SourceLocationCaveat";
import { areaDisplayName, cityNames, type CityBoundary, type CityMapMetric, type CitySafetySignal, type CitySlug, type Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";
import { buildVisitorPercentileMap, MAP_COLOR_BANDS } from "@/lib/map-filters";
import { bandNumber, metricForLayer } from "@/lib/map-view";
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

function normalise(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function formatted(value: number | null | undefined, locale: Locale, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: digits }).format(value);
}

function bandLabel(level: number | null, locale: Locale) {
  if (level === null) return tr(locale, "Insufficient data", "Datos insuficientes");
  return [
    tr(locale, "Among the lower recorded values", "Entre los valores registrados más bajos"),
    tr(locale, "Below the city middle", "Por debajo de la zona media"),
    tr(locale, "Around the city middle", "En la zona media de la ciudad"),
    tr(locale, "Above the city middle", "Por encima de la zona media"),
    tr(locale, "Among the higher recorded values", "Entre los valores registrados más altos"),
  ][level - 1];
}

export default function FieldExplorer({
  city, areas, boundaries, metrics, safetySignals, initialAreaId, initialMode, locale,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialAreaId);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const metricById = useMemo(() => new Map(metrics.map((metric) => [metric.areaId, metric])), [metrics]);
  const signalById = useMemo(() => new Map(safetySignals.map((signal) => [signal.areaId, signal])), [safetySignals]);
  const visitorById = useMemo(() => buildVisitorPercentileMap(metrics), [metrics]);
  const hasCityHarmSeries = city === "madrid" && safetySignals.some(
    (signal) => signal.months >= 3 && signal.residentPercentile !== null && signal.personalHarmPer10k !== null,
  );
  const residentLayer = hasCityHarmSeries ? "residential-harm" : "contextual-overview";
  const getEvidence = (id: string, currentMode: Mode) =>
    metricForLayer(
      metricById.get(id),
      currentMode === "visitor" ? "visitor-context" : residentLayer,
      signalById.get(id),
      visitorById.get(id) ?? null,
    );

  const values = useMemo(() => new Map(areas.map((area) => [
    area.id, getEvidence(area.id, mode).percentile,
    // getEvidence uses immutable source maps; mode is the only changing filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ])), [areas, metricById, signalById, visitorById, mode, residentLayer]);
  const eligible = Array.from(values.values()).filter((value) => value !== null && Number.isFinite(value)).length;

  const selected = selectedId ? areaById.get(selectedId) ?? null : null;
  const selectedMetric = selected ? metricById.get(selected.id) : undefined;
  const selectedSignal = selected ? signalById.get(selected.id) : undefined;
  const primary = selected ? getEvidence(selected.id, mode) : null;
  const level = primary ? bandNumber(primary.percentile) : null;
  const comparedArea = comparisonId ? areaById.get(comparisonId) ?? null : null;
  const compared = comparedArea ? getEvidence(comparedArea.id, mode) : null;
  const comparedLevel = compared ? bandNumber(compared.percentile) : null;
  const latest = metrics.reduce((current, metric) => metric.month > current ? metric.month : current, "");

  const suggestions = useMemo(() => {
    const term = normalise(query);
    if (!term) return [];
    return areas.filter((area) => normalise(areaDisplayName(area)).includes(term))
      .sort((a, b) => {
        const aFirst = normalise(a.name).startsWith(term) ? 0 : 1;
        const bFirst = normalise(b.name).startsWith(term) ? 0 : 1;
        return aFirst - bFirst || areaDisplayName(a).localeCompare(areaDisplayName(b), localeTag(locale));
      }).slice(0, 8);
  }, [areas, query, locale]);

  const compareSuggestions = useMemo(() => {
    const term = normalise(compareQuery);
    if (!term) return [];
    return areas.filter((area) => area.id !== selectedId && normalise(areaDisplayName(area)).includes(term))
      .slice(0, 6);
  }, [areas, compareQuery, selectedId]);

  function choose(id: string) {
    setSelectedId(id);
    setQuery("");
    setSearchOpen(false);
    setComparing(false);
    setCompareQuery("");
    setComparisonId(null);
  }

  const metricLabel = mode === "visitor"
    ? tr(locale, "Recorded theft/robbery-related incidents per km²", "Hurtos y robos registrados por km²")
    : city === "madrid" && hasCityHarmSeries
      ? tr(locale, "Selected personal-harm dispatches / 10,000 registered residents / month", "Incidencias seleccionadas de daño personal / 10.000 residentes / mes")
      : city === "madrid"
        ? tr(locale, "Selected violence/property dispatches / 10,000 registered residents", "Incidencias seleccionadas de violencia/propiedad / 10.000 residentes")
        : tr(locale, "Recorded violence + property / 10,000 Census residents", "Violencia y propiedad registradas / 10.000 habitantes del censo");

  const period = mode === "resident" && hasCityHarmSeries &&
    selectedSignal && selectedSignal.months >= 3 && primary?.value !== null
    ? selectedSignal.monthStart + " – " + selectedSignal.monthEnd
    : selectedMetric?.month ?? latest;

  const source = city === "madrid" ? {
    label: tr(locale, "Madrid Municipal Police dispatches", "Incidencias de Policía Municipal de Madrid"),
    url: "https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information",
    note: tr(locale, "Dispatch calls are not a certified count of crimes.", "Las incidencias policiales no equivalen a delitos acreditados."),
  } : {
    label: tr(locale, "Metropolitan Police / UK Police open data", "Metropolitan Police / datos abiertos británicos"),
    url: "https://data.police.uk/about/",
    note: tr(locale, "Recorded offences; geographic points are approximate.", "Delitos registrados; ubicaciones geográficas aproximadas."),
  };

  const explanation = mode === "visitor"
    ? tr(locale,
        "This is the concentration of selected recorded theft and robbery categories per km². It is not a visitor risk rate: comparable visitor counts are unavailable.",
        "Es la concentración de categorías seleccionadas de hurtos y robos registrados por km². No es una tasa de riesgo para visitantes: no disponemos de afluencia comparable.")
    : city === "madrid" && hasCityHarmSeries
      ? tr(locale,
          "Selected municipal police dispatches concerning personal harm per registered resident, averaged across available recent months. District-level perception surveys remain separate.",
          "Incidencias seleccionadas de Policía Municipal relacionadas con daños personales por residente empadronado, promediadas entre los meses recientes disponibles. Las encuestas distritales se mantienen aparte.")
      : city === "madrid"
        ? tr(locale,
            "The recent personal-harm series lacks enough city coverage, so the same selected violence/property dispatch indicator is used for all measured neighbourhoods.",
            "La serie reciente de daño personal no tiene cobertura suficiente, por lo que se aplica el mismo indicador seleccionado de incidencias de violencia/propiedad a todos los barrios con datos.")
        : tr(locale,
            "Selected recorded violence and property offences relative to 2021 Census residents; these categories differ from Madrid's municipal dispatches.",
            "Delitos seleccionados de violencia y propiedad registrados respecto a residentes del censo de 2021; no son equivalentes a las incidencias municipales de Madrid.");

  const langLink = localeHref(locale === "es" ? "en" : "es",
    "/lab/" + city + "?view=" + mode + (selected ? "&area=" + encodeURIComponent(selected.id) : ""));

  return (
    <main className="field-explorer" id="main-content">
      <header className="fx-header">
        <div className="fx-brand"><span className="fx-brand-mark" aria-hidden="true">◈</span><strong>dataSec</strong><span className="fx-beta">{tr(locale, "Explorer preview", "Nuevo explorador")}</span></div>
        <nav aria-label={tr(locale, "Choose a city", "Elige ciudad")} className="fx-cities">
          {(["madrid", "london"] as const).map((slug) => (
            <Link key={slug} className={city === slug ? "active" : ""}
              aria-current={city === slug ? "page" : undefined}
              href={localeHref(locale, "/lab/" + slug + "?view=" + mode)}>{cityNames[slug]}</Link>
          ))}
        </nav>
        <div className="fx-utility">
          <Link href={langLink} aria-label={tr(locale, "Switch language", "Cambiar idioma")}>{locale === "es" ? "EN" : "ES"}</Link>
          <Link href={localeHref(locale, "/")} className="fx-old-site">{tr(locale, "Old site ↗", "Web anterior ↗")}</Link>
        </div>
      </header>

      <section className="fx-toolbar" aria-label={tr(locale, "Explore recorded data", "Explorar datos registrados")}>
        <div className="fx-label">
          <span className="fx-kicker">{cityNames[city]} / {tr(locale, "Official data", "Datos oficiales")}</span>
          <h1>{tr(locale, "Explore an area", "Explora una zona")}</h1>
        </div>
        <div className="fx-controls">
          <div className="fx-search-wrap">
            <label htmlFor="fx-search">{tr(locale, "Which neighbourhood?", "¿Qué barrio buscas?")}</label>
            <div className="fx-search-box">
              <span aria-hidden="true">⌕</span>
              <input id="fx-search" type="search" autoComplete="off" value={query}
                placeholder={tr(locale, "Search by neighbourhood or district", "Busca por barrio o distrito")}
                onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter" && suggestions[0]) { event.preventDefault(); choose(suggestions[0].id); }
                }}/>
              {query ? <button type="button" aria-label={tr(locale, "Clear search", "Borrar búsqueda")}
                onClick={() => { setQuery(""); setSearchOpen(false); }}>×</button> : null}
            </div>
            {searchOpen && query.trim() ? (
              <div className="fx-suggestions" role="listbox" aria-label={tr(locale, "Matching places", "Zonas coincidentes")}>
                {suggestions.length ? suggestions.map((area) => (
                  <button role="option" aria-selected={selectedId === area.id} key={area.id}
                    type="button" onClick={() => choose(area.id)}>
                    <strong>{area.name}</strong><span>{area.parentName || cityNames[city]}</span>
                  </button>
                )) : <p>{tr(locale, "No matching area. Try a different name.", "Sin coincidencias. Prueba otro nombre.")}</p>}
              </div>
            ) : null}
          </div>
          <fieldset className="fx-purpose">
            <legend>{tr(locale, "I'm exploring for", "Quiero saber para")}</legend>
            <div className="fx-segment">
              <button type="button" aria-pressed={mode === "resident"} className={mode === "resident" ? "active" : ""}
                onClick={() => { setMode("resident"); setComparisonId(null); }}>
                {tr(locale, "Living", "Vivir")}
              </button>
              <button type="button" aria-pressed={mode === "visitor"} className={mode === "visitor" ? "active" : ""}
                onClick={() => { setMode("visitor"); setComparisonId(null); }}>
                {tr(locale, "Visiting", "Visitar")}
              </button>
            </div>
          </fieldset>
        </div>
      </section>

      <section className="fx-stage" aria-label={tr(locale, "Explore the map and place data", "Explora el mapa y los datos")}>
        <div className="fx-map-area">
          <AtlasMap city={city} boundaries={boundaries} areas={areas}
            values={values} selectedId={selectedId} onSelect={choose} locale={locale}/>
          <div className="fx-map-caption" aria-hidden="true">
            <span>{tr(locale, "Selected measure", "Indicador seleccionado")}</span>
            <strong>{mode === "visitor"
              ? tr(locale, "Theft & robbery records", "Registros de hurtos y robos")
              : tr(locale, "Resident-related records", "Registros relativos a residentes")}</strong>
          </div>
          <div className="fx-legend">
            <div className="fx-legend-heading">{tr(locale, "Relative to other areas in this city", "Comparado con otras zonas de esta ciudad")}</div>
            <div className="fx-legend-bars" aria-hidden="true">{MAP_COLOR_BANDS.map((band) => (
              <i key={band.max} style={{ background: band.color }}/>
            ))}</div>
            <div className="fx-legend-labels"><span>{tr(locale, "Lower recorded value", "Menos registros")}</span>
              <span>{tr(locale, "Higher recorded value", "Más registros")}</span></div>
            <small>{tr(locale, "Grey = no comparable data", "Gris = datos no comparables")}</small>
          </div>
        </div>

        <aside className="fx-dossier" aria-label={tr(locale, "Area information", "Información de la zona")}>
          {!selected || !primary ? (
            <div className="fx-empty">
              <div className="fx-empty-illustration" aria-hidden="true"><span>⌖</span></div>
              <span className="fx-kicker">{tr(locale, "Start here", "Empieza aquí")}</span>
              <h2>{tr(locale, "Pick a place.", "Elige un lugar.")}</h2>
              <p>{tr(locale,
                "Search for a neighbourhood above or select it on the map. The figures for that area will appear here.",
                "Busca un barrio arriba o selecciónalo en el mapa. Aquí verás sus cifras y cómo interpretarlas.")}</p>
              <div className="fx-empty-meta">
                <strong>{areas.length}</strong> {tr(locale, "areas mapped", "zonas cartografiadas")} ·
                {" "}<strong>{eligible}</strong> {tr(locale, "with comparable records", "con registros comparables")}
              </div>
              <p className="fx-empty-disclaimer">{tr(locale,
                "Map colours represent an official-source indicator, not a personal safety rating.",
                "Los colores representan un indicador de fuentes oficiales, no una nota de seguridad personal.")}</p>
            </div>
          ) : (
            <div className="fx-selected" key={selected.id + mode}>
              <div className="fx-place-top">
                <div><span className="fx-kicker">{selected.parentName || cityNames[city]}</span>
                  <h2>{selected.name}</h2></div>
                <button type="button" className="fx-clear" onClick={() => { setSelectedId(null); setComparisonId(null); setComparing(false); }}
                  aria-label={tr(locale, "Close area", "Cerrar zona")}>×</button>
              </div>
              <span className="fx-metric-eyebrow">{tr(locale, "Recorded indicator", "Indicador registrado")} · {period || "—"}</span>
              <div className="fx-main-number">
                <strong>{formatted(primary.value, locale)}</strong>
                <span>{metricLabel}</span>
              </div>
              <div className="fx-position">
                <strong>{bandLabel(level, locale)}</strong>
                <div className="fx-position-bars" role="img" aria-label={level === null
                  ? tr(locale, "No comparable value", "Sin dato comparable")
                  : tr(locale, "Local band ", "Tramo local ") + level + "/5"}>
                  {MAP_COLOR_BANDS.map((band, index) => (
                    <i key={band.max}
                      className={level === index + 1 ? "current" : ""}
                      style={{ background: band.color }}/>
                  ))}
                </div>
                <small>{tr(locale,
                  "Comparison within this city, for this indicator only.",
                  "Comparación dentro de esta ciudad y solo para este indicador.")}</small>
              </div>
              {isMadridDispatchLocationCaveat(city, selected.name) ?
                <div className="fx-caveat"><SourceLocationCaveat locale={locale}/></div> : null}
              <div className="fx-facts">
                <div><span>{tr(locale, "Relevant records", "Registros relevantes")}</span>
                  <strong>{formatted(primary.count, locale, 0)}</strong></div>
                <div><span>{tr(locale, "Observation period", "Período observado")}</span>
                  <strong>{period || "—"}</strong></div>
              </div>
              <div className="fx-actions">
                <button type="button" className="fx-compare-button"
                  onClick={() => { setComparing((value) => !value); setCompareQuery(""); }}>
                  {comparing ? tr(locale, "Close comparison −", "Cerrar comparación −")
                    : tr(locale, "Compare another area +", "Comparar otra zona +")}
                </button>
                {comparing ? (
                  <div className="fx-compare">
                    <label htmlFor="fx-compare-search">{tr(locale, "Second neighbourhood", "Segundo barrio")}</label>
                    <input id="fx-compare-search" type="search" value={compareQuery}
                      placeholder={tr(locale, "Search in this city", "Buscar en esta ciudad")}
                      onChange={(event) => { setCompareQuery(event.target.value); setComparisonId(null); }}/>
                    {compareQuery.trim() && !comparedArea ? (
                      <div className="fx-compare-results">
                        {compareSuggestions.map((area) => (
                          <button type="button" key={area.id} onClick={() => { setComparisonId(area.id); setCompareQuery(areaDisplayName(area)); }}>
                            {area.name}<span>{area.parentName}</span>
                          </button>
                        ))}
                        {!compareSuggestions.length ? <p>{tr(locale, "No matches", "Sin coincidencias")}</p> : null}
                      </div>
                    ) : null}
                    {comparedArea && compared ? (
                      <div className="fx-comparison">
                        {[{ area: selected, metric: primary, level }, { area: comparedArea, metric: compared, level: comparedLevel }].map((item) => (
                          <div key={item.area.id}>
                            <span>{item.area.name}</span>
                            <strong>{formatted(item.metric.value, locale)}</strong>
                            <small>{bandLabel(item.level, locale)}</small>
                          </div>
                        ))}
                        <p>{tr(locale,
                          "Same indicator, period and city. This is not a comparison of personal safety.",
                          "Mismo indicador, período y ciudad. No compara la seguridad personal.")}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <details className="fx-details">
                <summary>{tr(locale, "Understand these figures", "Entender estas cifras")} <span aria-hidden="true">⌄</span></summary>
                <p>{explanation}</p>
                <div className="fx-facts fx-extra">
                  <div><span>{tr(locale, "Theft/robbery per km²", "Hurtos y robos por km²")}</span><strong>{formatted(selectedMetric?.theftPerKm2, locale)}</strong></div>
                  <div><span>{tr(locale, "Violence/property per km²", "Violencia/propiedad por km²")}</span><strong>{formatted(selectedMetric?.violencePropertyPerKm2, locale)}</strong></div>
                  {city === "madrid" && selectedSignal?.districtNightSafety != null ?
                    <div><span>{tr(locale, "2025 district survey / 10 (different geography)", "Encuesta distrital de 2025 / 10 (otra geografía)")}</span>
                      <strong>{formatted(selectedSignal.districtNightSafety, locale)} / 10</strong></div> : null}
                </div>
                <p>{source.note}</p>
              </details>
              <div className="fx-deep-links">
                <Link href={localeHref(locale, areaHref(selected.id))}>{tr(locale, "Complete area profile ↗", "Ficha completa de la zona ↗")}</Link>
                <Link href={localeHref(locale, "/lab/" + city + "?view=" + mode + "&area=" + encodeURIComponent(selected.id))}>
                  {tr(locale, "Link to this view ↗", "Enlace a esta vista ↗")}</Link>
              </div>
            </div>
          )}
          <div className="fx-source">
            <span>{tr(locale, "Official source", "Fuente oficial")}</span>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
            <small>{source.note}</small>
            <Link href={localeHref(locale, "/methodology")}>{tr(locale, "Methodology & limits", "Metodología y límites")} ↗</Link>
          </div>
        </aside>
      </section>
      <footer className="fx-footer">
        <span>{tr(locale,
          "Recorded geographic patterns do not predict individual safety.",
          "Los registros geográficos no predicen la seguridad individual.")}</span>
        <span>{tr(locale, "Last stored source month", "Último mes almacenado")}: {latest || "—"} · {eligible}/{areas.length} {tr(locale, "comparable areas", "zonas comparables")}</span>
      </footer>
    </main>
  );
}
