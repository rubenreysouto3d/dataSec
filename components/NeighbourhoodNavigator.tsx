"use client";

import { useMemo, useState } from "react";
import type { CityMapMetric, CitySafetySignal, Neighbourhood } from "@/lib/data";
import { MAP_COLOR_BANDS } from "@/lib/map-filters";
import { areaDisplayName } from "@/lib/data";
import { bandNumber, bandMode, metricForLayer, relativeBand, type MapLayerKey } from "@/lib/map-view";
import { tr, type Locale } from "@/lib/i18n";

type Props = {
  areas: Neighbourhood[];
  metrics: CityMapMetric[];
  safetySignals: CitySafetySignal[];
  visitorPercentiles: Map<string, number | null>;
  layer: MapLayerKey;
  cityName: string;
  locale: Locale;
  selectedAreaId: string | null;
  onSelect: (areaId: string) => void;
};

type Filter = "all" | "lower" | "higher" | "missing";
type Order = "alphabetical" | "ascending" | "descending";

const PREVIEW_SIZE = 18;

/**
 * Synchronized local-data browser. A ranked indicator is never described as a
 * probability of an incident or a city-wide / cross-city safety judgement.
 */
export default function NeighbourhoodNavigator({
  areas, metrics, safetySignals, visitorPercentiles, layer, cityName,
  locale, selectedAreaId, onSelect,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<Order>("alphabetical");
  const [limit, setLimit] = useState(PREVIEW_SIZE);
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const metricById = useMemo(() => new Map(metrics.map((item) => [item.areaId, item])), [metrics]);
  const safetyById = useMemo(() => new Map(safetySignals.map((item) => [item.areaId, item])), [safetySignals]);

  const rows = useMemo(
    () => areas.map((area) => {
      const metric = metricForLayer(
        metricById.get(area.id),
        layer,
        safetyById.get(area.id),
        visitorPercentiles.get(area.id) ?? null,
      );
      return { area, percentile: metric.percentile, level: bandNumber(metric.percentile) };
    }),
    [areas, metricById, layer, safetyById, visitorPercentiles],
  );
  const available = rows.filter((row) => row.level !== null).length;
  const cleanSearch = search.trim().toLocaleLowerCase(locale === "es" ? "es" : "en");
  const matches = useMemo(() => {
    const matching = rows.filter(({ area, level }) => {
      const fullName = areaDisplayName(area).toLocaleLowerCase(locale === "es" ? "es" : "en");
      if (cleanSearch && !fullName.includes(cleanSearch)) return false;
      if (filter === "missing") return level === null;
      if (filter === "lower") return level !== null && level <= 2;
      if (filter === "higher") return level !== null && level >= 4;
      return true;
    });
    matching.sort((a, b) => {
      if (order === "alphabetical") {
        return a.area.name.localeCompare(b.area.name, locale === "es" ? "es" : "en");
      }
      // Missing data always goes last; do not treat null as zero/low.
      if (a.percentile === null) return b.percentile === null ? 0 : 1;
      if (b.percentile === null) return -1;
      return (order === "ascending" ? 1 : -1) * (a.percentile - b.percentile) ||
        a.area.name.localeCompare(b.area.name);
    });
    return matching;
  }, [rows, cleanSearch, filter, order, locale]);

  const setCategory = (next: Filter) => { setFilter(next); setLimit(PREVIEW_SIZE); };
  const header = (
    <div className="research-sidebar-heading">
      <span className="data-kicker">{tr(locale, "Explore the evidence", "Explora los datos")}</span>
      <h2>{tr(locale, "Neighbourhoods", "Barrios y zonas")}</h2>
      <p>{tr(locale,
        `Compare the selected indicator within ${cityName}. Select an area to connect the list and map.`,
        `Compara el indicador seleccionado dentro de ${cityName}. Elige una zona para vincular la lista y el mapa.`,
      )}</p>
      <div className="research-coverage" aria-label={tr(locale, `${available} of ${areas.length} areas with a value`, `${available} de ${areas.length} zonas con dato disponible`)}>
        <strong>{available}/{areas.length}</strong>
        <span>{tr(locale, "areas with data for this view", "zonas con datos para esta vista")}</span>
      </div>
    </div>
  );

  return (
    <aside className="research-sidebar" aria-label={tr(locale, "Neighbourhood evidence browser", "Explorador de datos por barrios")}>
      <button
        type="button"
        className="research-mobile-toggle"
        aria-expanded={openOnMobile}
        onClick={() => setOpenOnMobile((old) => !old)}
      >
        {tr(locale, "Explore neighbourhoods", "Explorar barrios")}
        <span aria-hidden="true">{openOnMobile ? "−" : "+"}</span>
      </button>
      <div className={`research-sidebar-inner ${openOnMobile ? "is-open" : ""}`}>
        {header}
        <div className="research-sidebar-controls">
          <label htmlFor="research-search">{tr(locale, "Find by name", "Buscar por nombre")}</label>
          <input
            id="research-search"
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setLimit(PREVIEW_SIZE); }}
            placeholder={tr(locale, "Name or borough…", "Barrio o distrito…")}
          />
          <fieldset className="research-quick-filters">
            <legend>{tr(locale, "Show areas", "Mostrar zonas")}</legend>
            {([
              ["all", tr(locale, "All", "Todas")],
              ["lower", tr(locale, "Levels 1–2", "Niveles 1–2")],
              ["higher", tr(locale, "Levels 4–5", "Niveles 4–5")],
              ["missing", tr(locale, "No data", "Sin datos")],
            ] as const).map(([value, label]) => (
              <button
                type="button" key={value}
                className={filter === value ? "is-active" : ""}
                aria-pressed={filter === value}
                onClick={() => setCategory(value)}
              >{label}</button>
            ))}
          </fieldset>
          <label htmlFor="research-sort">{tr(locale, "Order by", "Ordenar por")}</label>
          <select
            id="research-sort"
            value={order}
            onChange={(event) => { setOrder(event.target.value as Order); setLimit(PREVIEW_SIZE); }}
          >
            <option value="alphabetical">{tr(locale, "Name A–Z", "Nombre A–Z")}</option>
            <option value="ascending">{tr(locale, "Lower recorded indicator first", "Indicador registrado menor primero")}</option>
            <option value="descending">{tr(locale, "Higher recorded indicator first", "Indicador registrado mayor primero")}</option>
          </select>
        </div>
        <div className="research-list-topline">
          <strong>{matches.length.toLocaleString(locale === "es" ? "es-ES" : "en-GB")} {tr(locale, "matching", "coincidencias")}</strong>
          <small>{tr(locale, "Within-city levels", "Niveles locales")}</small>
        </div>
        <div className="research-area-list">
          {matches.length === 0 ? (
            <p className="research-no-results">{tr(locale, "No areas match. Clear the search or choose a different level.", "No hay resultados. Borra la búsqueda o elige otro nivel.")}</p>
          ) : matches.slice(0, limit).map(({ area, level, percentile }) => (
            <button
              type="button"
              key={area.id}
              className={`research-area-row ${selectedAreaId === area.id ? "is-selected" : ""}`}
              aria-pressed={selectedAreaId === area.id}
              onClick={() => { onSelect(area.id); setOpenOnMobile(false); }}
            >
              <span
                className={`research-level-badge ${level === null ? "is-missing" : ""}`}
                style={level === null ? undefined : { backgroundColor: MAP_COLOR_BANDS[level - 1].color }}
                aria-hidden="true"
              >{level ?? "–"}</span>
              <span className="research-row-copy">
                <strong>{area.name}</strong>
                <small>{area.parentName || cityName}</small>
              </span>
              <span className="research-row-level">
                {level === null
                  ? tr(locale, "No data", "Sin datos")
                  : relativeBand(percentile, bandMode(layer === "contextual-overview" ? "contextual-overview" : layer === "visitor-context" ? "visitor-context" : "crime-related"), locale).replace(/^(Lowest|Lower|Highest|Menor|Mayor|Más baja|Más alta).*/, (text) => text)}
              </span>
            </button>
          ))}
        </div>
        {matches.length > limit ? (
          <button className="research-load-more" type="button" onClick={() => setLimit((old) => old + PREVIEW_SIZE)}>
            {tr(locale, "Show more", "Mostrar más")} ({matches.length - limit})
          </button>
        ) : null}
        <p className="research-sidebar-caution">{tr(locale,
          "These levels describe recorded local indicators, not the chance of something happening to you. No data is never level 1.",
          "Los niveles describen indicadores locales registrados, no la probabilidad de que te ocurra algo. Sin datos nunca equivale al nivel 1.",
        )}</p>
      </div>
    </aside>
  );
}
