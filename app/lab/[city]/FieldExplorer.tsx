"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AtlasMap from "./AtlasMap";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import SourceLocationCaveat, { isMadridDispatchLocationCaveat } from "@/components/SourceLocationCaveat";
import { areaDisplayName, cityNames, type CityBoundary, type CityMapMetric, type CitySafetySignal, type CitySlug, type Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";
import { MAP_COLOR_BANDS } from "@/lib/map-filters";
import { bandNumber } from "@/lib/map-view";
import { createPlaceEvidenceContext, placeEvidenceExplanation, placeEvidenceLabel, placeEvidenceSource } from "@/lib/place-evidence";
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
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [geoCandidate, setGeoCandidate] = useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);
  const [comparing, setComparing] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const metricById = useMemo(() => new Map(metrics.map((metric) => [metric.areaId, metric])), [metrics]);
  const signalById = useMemo(() => new Map(safetySignals.map((signal) => [signal.areaId, signal])), [safetySignals]);
  const evidenceContext = useMemo(
    () => createPlaceEvidenceContext(city, metrics, safetySignals),
    [city, metrics, safetySignals],
  );
  const hasCityHarmSeries = evidenceContext.hasCityHarmSeries;
  const getEvidence = evidenceContext.read;

  const values = useMemo(() => new Map(areas.map((area) => [
    area.id, getEvidence(area.id, mode).percentile,
  ])), [areas, evidenceContext, mode]);
  const eligible = Array.from(values.values()).filter((value) => value !== null && Number.isFinite(value)).length;

  const selected = selectedId ? areaById.get(selectedId) ?? null : null;
  const selectedMetric = selected ? metricById.get(selected.id) : undefined;
  const selectedSignal = selected ? signalById.get(selected.id) : undefined;
  const primary = selected ? getEvidence(selected.id, mode) : null;
  const level = primary ? bandNumber(primary.percentile) : null;
  const comparedArea = comparisonId ? areaById.get(comparisonId) ?? null : null;
  const compared = comparedArea ? getEvidence(comparedArea.id, mode) : null;
  const comparedLevel = compared ? bandNumber(compared.percentile) : null;
  const comparisonMetric = comparedArea ? metricById.get(comparedArea.id) : undefined;
  const latest = metrics.reduce((current, metric) => metric.month > current ? metric.month : current, "");
  const [shareStatus, setShareStatus] = useState("");
  // Selection and purpose are URL state: the same link opens in web/mobile
  // and can be consumed by the browser extension without duplicating a view.
  useEffect(() => {
    const next = new URL(window.location.href);
    next.searchParams.set("view", mode);
    if (selectedId) next.searchParams.set("area", selectedId);
    else next.searchParams.delete("area");
    window.history.replaceState(window.history.state, "", next.pathname + next.search + next.hash);
    setShareStatus("");
  }, [mode, selectedId]);

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
    setGeoCandidate(null);
    setGeoError("");
    setComparing(false);
    setCompareQuery("");
    setComparisonId(null);
  }

  async function lookupTypedAddress() {
    const typed = query.trim();
    if (typed.length < 4 || geoLoading) return;
    setGeoLoading(true);
    setGeoError("");
    setGeoCandidate(null);
    try {
      const matched = await resolvePlaceToArea(typed);
      if (matched) setGeoCandidate(matched);
      else setGeoError(tr(locale,
        "No precise area match in Madrid/London. Include a full address and city.",
        "No se encontró una zona precisa en Madrid/Londres. Incluye dirección completa y ciudad."));
    } catch {
      setGeoError(tr(locale, "Address service temporarily unavailable.", "Servicio de direcciones no disponible temporalmente."));
    } finally {
      setGeoLoading(false);
    }
  }

  const metricLabel = placeEvidenceLabel(city, mode, hasCityHarmSeries, locale);
  const period = primary?.period ?? null;
  const comparisonPeriod = compared?.period ?? null;
  const source = placeEvidenceSource(city, locale);
  const explanation = placeEvidenceExplanation(city, mode, hasCityHarmSeries, locale);

  const langLink = localeHref(locale === "es" ? "en" : "es",
    "/explore/" + city + "?view=" + mode + (selected ? "&area=" + encodeURIComponent(selected.id) : ""));

  return (
    <main className="field-explorer" id="main-content">
      <header className="fx-header">
        <div className="fx-brand"><span className="fx-brand-mark" aria-hidden="true">◈</span><strong>dataSec</strong><span className="fx-beta">{tr(locale, "Explorer", "Explorador")}</span></div>
        <nav aria-label={tr(locale, "Choose a city", "Elige ciudad")} className="fx-cities">
          {(["madrid", "london"] as const).map((slug) => (
            <Link key={slug} className={city === slug ? "active" : ""}
              aria-current={city === slug ? "page" : undefined}
              href={localeHref(locale, "/explore/" + slug + "?view=" + mode)}>{cityNames[slug]}</Link>
          ))}
        </nav>
        <div className="fx-utility">
          <Link href={langLink} aria-label={tr(locale, "Switch language", "Cambiar idioma")}>{locale === "es" ? "EN" : "ES"}</Link>
          <Link href={localeHref(locale, "/")} className="fx-old-site">{tr(locale, "Home ↗", "Inicio ↗")}</Link>
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
                placeholder={tr(locale, "Neighbourhood or full address", "Barrio o dirección completa")}
                onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setGeoCandidate(null); setGeoError(""); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter" && suggestions[0]) { event.preventDefault(); choose(suggestions[0].id); }
                }}/>
              {query ? <button type="button" aria-label={tr(locale, "Clear search", "Borrar búsqueda")}
                onClick={() => { setQuery(""); setSearchOpen(false); setGeoCandidate(null); setGeoError(""); }}>×</button> : null}
            </div>
            {searchOpen && query.trim() ? (
              <div className="fx-suggestions" role="group" aria-label={tr(locale, "Matching places", "Zonas coincidentes")}>
                {suggestions.length ? suggestions.map((area) => (
                  <button aria-pressed={selectedId === area.id} key={area.id}
                    type="button" onClick={() => choose(area.id)}>
                    <strong>{area.name}</strong><span>{area.parentName || cityNames[city]}</span>
                  </button>
                )) : <p>{tr(locale, "No official area matches. A full address may be resolved below.", "No coincide ningún barrio oficial. Puedes consultar una dirección completa abajo.")}</p>}
                {query.trim().length >= 4 ? (
                  <div className="fx-geo-lookup">
                    <button type="button" disabled={geoLoading} onClick={lookupTypedAddress}>
                      {geoLoading
                        ? tr(locale, "Finding address…", "Buscando dirección…")
                        : tr(locale, "Look up this address ↗", "Consultar esta dirección ↗")}
                    </button>
                    <small>{tr(locale,
                      "Explicit lookup via OpenStreetMap. Confirm the matched address before opening.",
                      "Búsqueda explícita mediante OpenStreetMap. Comprueba la dirección encontrada antes de abrirla.")}</small>
                    {geoCandidate ? <div className="fx-geo-match" role="status">
                      <strong>{geoCandidate.matchedPlace}</strong>
                      <span>{geoCandidate.name} · {geoCandidate.citySlug === "madrid" ? "Madrid" : "London"}</span>
                      {geoCandidate.citySlug === city
                        ? <button type="button" onClick={() => choose(geoCandidate.id)}>
                            {tr(locale, "Confirm and open this area →", "Confirmar y abrir esta zona →")}
                          </button>
                        : <Link href={localeHref(locale, "/explore/" + geoCandidate.citySlug + "?view=" + mode + "&area=" + encodeURIComponent(geoCandidate.id))}>
                            {tr(locale, "Confirm and switch city →", "Confirmar y cambiar de ciudad →")}
                          </Link>}
                    </div> : null}
                    {geoError ? <p role="alert">{geoError}</p> : null}
                  </div>
                ) : null}
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
            <strong>{metricLabel}</strong>
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
                  "Same-city comparison of this recorded indicator. Not a measure of personal safety.",
                  "Comparación de este indicador dentro de la ciudad. No mide la seguridad personal.")}</small>
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
                        {[{ area: selected, metric: primary, level, period }, { area: comparedArea, metric: compared, level: comparedLevel, period: comparisonPeriod }].map((item) => (
                          <div key={item.area.id}>
                            <span>{item.area.name}</span>
                            <strong>{formatted(item.metric.value, locale)}</strong>
                            <small>{bandLabel(item.level, locale)}</small>
                            <small>{item.period || "—"}</small>
                          </div>
                        ))}
                        <p>{tr(locale,
                          "Same indicator and city; observation periods are shown separately. This is not a personal safety ranking.",
                          "Mismo indicador y ciudad; se indican los períodos de cada zona. No clasifica la seguridad personal.")}</p>
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
                <button type="button" onClick={async () => {
                  const share = new URL(window.location.href);
                  share.searchParams.set("view", mode);
                  share.searchParams.set("area", selected.id);
                  try {
                    await navigator.clipboard.writeText(share.toString());
                    setShareStatus(tr(locale, "Link copied", "Enlace copiado"));
                  } catch {
                    setShareStatus(tr(locale, "Use the link below to share this place.", "Utiliza el enlace de abajo para compartir esta zona."));
                  }
                }}>{tr(locale, "Copy this place link ↗", "Copiar enlace de la zona ↗")}</button>
                {shareStatus ? <span role="status">{shareStatus}</span> : null}
                <Link href={localeHref(locale, areaHref(selected.id))}>{tr(locale, "Complete area profile ↗", "Ficha completa de la zona ↗")}</Link>
                <Link href={localeHref(locale, "/explore/" + city + "?view=" + mode + "&area=" + encodeURIComponent(selected.id))}>
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
