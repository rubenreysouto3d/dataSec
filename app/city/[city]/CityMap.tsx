"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { areaHref } from "@/lib/area-route";
import type {
  CityActivityContext,
  CityBoundary,
  CityMapMetric,
  CitySlug,
  Neighbourhood,
} from "@/lib/data";

type Props = {
  citySlug: CitySlug;
  areas: Neighbourhood[];
  boundaries: CityBoundary[];
  metrics: CityMapMetric[];
  activityContexts: CityActivityContext[];
};

type MetricKey = "violence-property" | "theft" | "crime-related" | "activity";
type NormalizationKey = "density" | "resident";
type LayerKey =
  | "violence-property"
  | "theft"
  | "crime-related"
  | "activity"
  | "violence-property-resident"
  | "theft-resident"
  | "crime-related-resident";

type Bounds = [[number, number], [number, number]];

type MapLibreModule = {
  Map: new (options: Record<string, unknown>) => any;
  Popup: new (options?: Record<string, unknown>) => any;
  NavigationControl: new (options?: Record<string, unknown>) => any;
  ScaleControl: new (options?: Record<string, unknown>) => any;
};

const MAPLIBRE_URL = "https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs";
const MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.css";
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const metricCopy: Record<MetricKey, { label: string; short: string; note: string }> = {
  "violence-property": {
    label: "Violence & property",
    short: "Violence + property",
    note: "Selected violence and property-related source categories.",
  },
  theft: {
    label: "Theft & robbery",
    short: "Theft + robbery",
    note: "Theft, robbery and vehicle/property-theft source categories.",
  },
  "crime-related": {
    label: "All crime-related",
    short: "All crime-related",
    note: "Crime-related source categories. London anti-social behaviour and Madrid non-crime dispatch activity are excluded.",
  },
  activity: {
    label: "All source activity",
    short: "All activity",
    note: "Everything in the source, including non-crime Madrid police dispatch activity.",
  },
};

function metricKeyForLayer(layer: LayerKey): MetricKey {
  return layer.replace("-resident", "") as MetricKey;
}

function normalizationForLayer(layer: LayerKey): NormalizationKey {
  return layer.endsWith("-resident") ? "resident" : "density";
}

function layerFor(metric: MetricKey, normalization: NormalizationKey): LayerKey {
  if (normalization === "resident" && metric !== "activity") {
    return `${metric}-resident` as LayerKey;
  }
  return metric;
}

function metricForLayer(metric: CityMapMetric | undefined, layer: LayerKey) {
  if (!metric) return { percentile: null, value: null, count: null, unit: "" };

  switch (layer) {
    case "activity":
      return {
        percentile: metric.densityPercentile,
        value: metric.incidentsPerKm2,
        count: metric.totalIncidents,
        unit: "/km²",
      };
    case "crime-related":
      return {
        percentile: metric.crimeRelatedDensityPercentile,
        value: metric.crimeRelatedPerKm2,
        count: metric.crimeRelatedCount,
        unit: "/km²",
      };
    case "theft":
      return {
        percentile: metric.theftDensityPercentile,
        value: metric.theftPerKm2,
        count: metric.theftCount,
        unit: "/km²",
      };
    case "violence-property-resident":
      return {
        percentile: metric.violencePropertyResidentPercentile,
        value: metric.violencePropertyPer10k,
        count: metric.violencePropertyCount,
        unit: "/10k residents",
      };
    case "theft-resident":
      return {
        percentile: metric.theftResidentPercentile,
        value: metric.theftPer10k,
        count: metric.theftCount,
        unit: "/10k residents",
      };
    case "crime-related-resident":
      return {
        percentile: metric.crimeRelatedResidentPercentile,
        value: metric.crimeRelatedPer10k,
        count: metric.crimeRelatedCount,
        unit: "/10k residents",
      };
    default:
      return {
        percentile: metric.violencePropertyDensityPercentile,
        value: metric.violencePropertyPerKm2,
        count: metric.violencePropertyCount,
        unit: "/km²",
      };
  }
}

function ensureMapLibreCss() {
  if (document.querySelector("link[data-datasec-maplibre]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = MAPLIBRE_CSS;
  link.dataset.datasecMaplibre = "true";
  document.head.appendChild(link);
}

async function loadMapLibre(): Promise<MapLibreModule> {
  const dynamicImport = new Function("url", "return import(url)") as (
    url: string,
  ) => Promise<MapLibreModule>;
  return dynamicImport(MAPLIBRE_URL);
}

function boundaryBounds(boundary: CityBoundary): Bounds | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const ring of boundary.rings) {
    for (const point of ring) {
      const lng = Number(point.longitude);
      const lat = Number(point.latitude);
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return Number.isFinite(minLng) ? [[minLng, minLat], [maxLng, maxLat]] : null;
}

function formatMetric(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return "No value";
  return value.toLocaleString("en-GB", { maximumFractionDigits: 1 }) + unit;
}

function formatMonth(month: string | undefined) {
  if (!month) return "Latest snapshot";
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
}

function relativeBand(percentile: number | null) {
  if (percentile === null || !Number.isFinite(percentile)) return "No city comparison";
  if (percentile < 0.2) return "Lowest 20% of areas";
  if (percentile < 0.4) return "Lower than most areas";
  if (percentile < 0.6) return "Around the middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "Highest 20% of areas";
}

export default function CityMap({ citySlug, areas, boundaries, metrics, activityContexts }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const residentCoverage = metrics.filter((metric) => metric.population !== null).length;
  const hasResidentLayer = residentCoverage >= Math.max(1, Math.floor(areas.length * 0.8));
  const [layer, setLayer] = useState<LayerKey>("violence-property");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");

  const cityName = citySlug === "madrid" ? "Madrid" : "London";
  const metricKey = metricKeyForLayer(layer);
  const normalization = normalizationForLayer(layer);
  const latestMonth = metrics.reduce(
    (latest, metric) => (!latest || metric.month > latest ? metric.month : latest),
    "",
  );

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  );
  const metricById = useMemo(
    () => new Map(metrics.map((metric) => [metric.areaId, metric])),
    [metrics],
  );
  const boundaryById = useMemo(
    () => new Map(boundaries.map((boundary) => [boundary.areaId, boundary])),
    [boundaries],
  );
  const activityById = useMemo(
    () => new Map(activityContexts.map((context) => [context.areaId, context])),
    [activityContexts],
  );

  const bounds = useMemo(() => {
    let minLng = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const boundary of boundaries) {
      for (const ring of boundary.rings) {
        for (const point of ring) {
          const lng = Number(point.longitude);
          const lat = Number(point.latitude);
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }

    return Number.isFinite(minLng)
      ? [[minLng, minLat], [maxLng, maxLat]]
      : null;
  }, [boundaries]);

  const geojson = useMemo(() => {
    const features = boundaries.flatMap((boundary) => {
      const area = areaById.get(boundary.areaId);
      if (!area || !boundary.rings.length) return [];
      const selected = metricForLayer(metricById.get(boundary.areaId), layer);
      const coordinates = boundary.rings.map((ring) =>
        ring.map((point) => [Number(point.longitude), Number(point.latitude)]),
      );

      return [{
        type: "Feature",
        properties: {
          id: area.id,
          name: area.name,
          href: areaHref(area.id),
          percentile: selected.percentile,
          value: selected.value,
          count: selected.count,
          unit: selected.unit,
          population: metricById.get(area.id)?.population ?? null,
        },
        geometry: boundary.rings.length === 1
          ? { type: "Polygon", coordinates: [coordinates[0]] }
          : { type: "MultiPolygon", coordinates: coordinates.map((ring) => [ring]) },
      }];
    });

    return { type: "FeatureCollection", features };
  }, [areaById, boundaries, layer, metricById]);

  const selectedArea = selectedAreaId ? areaById.get(selectedAreaId) ?? null : null;
  const selectedBaseMetric = selectedAreaId ? metricById.get(selectedAreaId) : undefined;
  const selectedActivity = selectedAreaId ? activityById.get(selectedAreaId) : undefined;
  const selectedMetric = metricForLayer(selectedBaseMetric, layer);
  const selectedPercentile =
    selectedMetric.percentile !== null && Number.isFinite(selectedMetric.percentile)
      ? Math.round(selectedMetric.percentile * 100)
      : null;

  function chooseMetric(nextMetric: MetricKey) {
    const nextNormalization =
      normalization === "resident" && nextMetric !== "activity" && hasResidentLayer
        ? "resident"
        : "density";
    setLayer(layerFor(nextMetric, nextNormalization));
  }

  function chooseNormalization(nextNormalization: NormalizationKey) {
    if (nextNormalization === "resident" && (!hasResidentLayer || metricKey === "activity")) return;
    setLayer(layerFor(metricKey, nextNormalization));
  }

  function focusArea(areaId: string) {
    const boundary = boundaryById.get(areaId);
    const area = areaById.get(areaId);
    if (!boundary || !area || !mapRef.current) return;
    const itemBounds = boundaryBounds(boundary);
    if (!itemBounds) return;
    setSelectedAreaId(areaId);
    setAreaSearch(area.name);
    mapRef.current.fitBounds(itemBounds, {
      padding: 90,
      duration: 500,
      maxZoom: 14,
    });
  }

  function findArea() {
    const needle = areaSearch.trim().toLocaleLowerCase();
    if (!needle) return;
    const exact = areas.find((area) => area.name.toLocaleLowerCase() === needle);
    const partial = areas.find((area) => area.name.toLocaleLowerCase().includes(needle));
    const match = exact ?? partial;
    if (match) focusArea(match.id);
  }

  function fitToCity() {
    if (!mapRef.current || !bounds) return;
    setSelectedAreaId(null);
    setAreaSearch("");
    mapRef.current.fitBounds(bounds, {
      padding: 42,
      duration: 450,
      maxZoom: citySlug === "madrid" ? 12 : 11,
    });
  }

  useEffect(() => {
    let cancelled = false;
    let map: any;

    async function start() {
      if (!containerRef.current || !bounds) return;
      try {
        ensureMapLibreCss();
        const maplibre = await loadMapLibre();
        if (cancelled || !containerRef.current) return;

        map = new maplibre.Map({
          container: containerRef.current,
          style: MAP_STYLE,
          center: citySlug === "madrid" ? [-3.7038, 40.4168] : [-0.1276, 51.5072],
          zoom: citySlug === "madrid" ? 9.5 : 8.7,
          attributionControl: true,
          cooperativeGestures: false,
        });
        mapRef.current = map;

        map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), "top-right");
        map.addControl(new maplibre.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
        popupRef.current = new maplibre.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          maxWidth: "300px",
        });

        map.on("load", () => {
          if (cancelled) return;
          map.addSource("datasec-areas", {
            type: "geojson",
            data: geojson,
            promoteId: "id",
          });
          const firstLabelLayer = map.getStyle().layers?.find(
            (styleLayer: any) => styleLayer.type === "symbol",
          )?.id;

          map.addLayer({
            id: "datasec-areas-fill",
            type: "fill",
            source: "datasec-areas",
            paint: {
              "fill-color": [
                "case",
                ["==", ["get", "percentile"], null],
                "#c8c6bf",
                [
                  "step",
                  ["to-number", ["get", "percentile"]],
                  "#eaf2f7",
                  0.2, "#cbddea",
                  0.4, "#9abdd3",
                  0.6, "#5d91b4",
                  0.8, "#225f86",
                ],
              ],
              "fill-opacity": 0.74,
            },
          }, firstLabelLayer);

          map.addLayer({
            id: "datasec-areas-line",
            type: "line",
            source: "datasec-areas",
            paint: {
              "line-color": "rgba(255,255,255,.88)",
              "line-width": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 0.7,
                12, 1.5,
                15, 2.2,
              ],
            },
          }, firstLabelLayer);

          map.addLayer({
            id: "datasec-selected-line",
            type: "line",
            source: "datasec-areas",
            filter: ["==", ["get", "id"], ""],
            paint: {
              "line-color": "#11110f",
              "line-width": 4,
            },
          }, firstLabelLayer);

          map.on("mousemove", "datasec-areas-fill", (event: any) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = event.features?.[0];
            if (!feature) return;
            const props = feature.properties ?? {};
            const card = document.createElement("div");
            card.className = "datasec-map-tooltip";

            const title = document.createElement("strong");
            title.textContent = String(props.name ?? "");

            const detail = document.createElement("span");
            const value = Number(props.value);
            const percentile = Number(props.percentile);
            detail.textContent = Number.isFinite(value)
              ? `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${props.unit ?? ""}`
              : "No value";

            const context = document.createElement("small");
            context.textContent = Number.isFinite(percentile)
              ? `Higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
              : "No city comparison available";

            const hint = document.createElement("small");
            hint.textContent = "Click for details";

            card.append(title, detail, context, hint);
            popupRef.current
              ?.setLngLat(event.lngLat)
              .setDOMContent(card)
              .addTo(map);
          });

          map.on("mouseleave", "datasec-areas-fill", () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
          });

          map.on("click", "datasec-areas-fill", (event: any) => {
            const areaId = event.features?.[0]?.properties?.id;
            if (!areaId) return;
            setSelectedAreaId(String(areaId));
            const area = areaById.get(String(areaId));
            if (area) setAreaSearch(area.name);
          });

          map.fitBounds(bounds, {
            padding: 42,
            duration: 0,
            maxZoom: citySlug === "madrid" ? 12 : 11,
          });
          setMapReady(true);
        });
      } catch (error) {
        console.error(error);
        if (!cancelled) setMapError("The interactive basemap could not be loaded.");
      }
    }

    start();
    return () => {
      cancelled = true;
      popupRef.current?.remove();
      if (map) map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [bounds, citySlug]);

  useEffect(() => {
    const source = mapRef.current?.getSource?.("datasec-areas");
    source?.setData?.(geojson);
  }, [geojson]);

  useEffect(() => {
    if (!mapReady || !mapRef.current?.getLayer?.("datasec-selected-line")) return;
    mapRef.current.setFilter(
      "datasec-selected-line",
      ["==", ["get", "id"], selectedAreaId ?? ""],
    );
  }, [mapReady, selectedAreaId]);

  const metricOptions: Array<{ key: MetricKey; label: string }> = [
    { key: "violence-property", label: "Violence + property" },
    { key: "theft", label: "Theft + robbery" },
    { key: "crime-related", label: "All crime-related" },
    { key: "activity", label: citySlug === "madrid" ? "All police activity" : "All source activity" },
  ];

  return (
    <section className="city-map-panel interactive-map-panel">
      <div className="map-understand-head">
        <div className="map-title-block">
          <span>INTERACTIVE MAP · {formatMonth(latestMonth)}</span>
          <h2>{metricCopy[metricKey].label}</h2>
          <p>{metricCopy[metricKey].note}</p>
        </div>

        <div className="map-reading-card">
          <strong>How to read this map</strong>
          <p>
            Darker areas recorded more of the selected metric than most other {cityName} areas
            in the same snapshot. It is a relative comparison, not a “safe / dangerous” score.
          </p>
        </div>
      </div>

      <div className="map-controls-grid">
        <div className="map-control-group">
          <span className="map-control-kicker">1 · What do you want to compare?</span>
          <div className="map-choice-row" role="group" aria-label="Incident type">
            {metricOptions.map((item) => (
              <button
                type="button"
                key={item.key}
                className={metricKey === item.key ? "is-active" : ""}
                aria-pressed={metricKey === item.key}
                onClick={() => chooseMetric(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="map-control-group">
          <span className="map-control-kicker">2 · How should areas be compared?</span>
          <div className="map-choice-row map-normalization-row" role="group" aria-label="Comparison basis">
            <button
              type="button"
              className={normalization === "density" ? "is-active" : ""}
              aria-pressed={normalization === "density"}
              onClick={() => chooseNormalization("density")}
            >
              <strong>By area</strong>
              <small>incidents per km²</small>
            </button>
            <button
              type="button"
              className={normalization === "resident" ? "is-active" : ""}
              aria-pressed={normalization === "resident"}
              disabled={!hasResidentLayer || metricKey === "activity"}
              onClick={() => chooseNormalization("resident")}
            >
              <strong>By residents</strong>
              <small>per 10,000 registered residents</small>
            </button>
          </div>
          {metricKey === "activity" ? (
            <p className="map-control-help">All source activity is only available by area density.</p>
          ) : normalization === "resident" ? (
            <p className="map-control-help">
              Useful for residential context, but visitor-heavy centres can look artificially high.
            </p>
          ) : (
            <p className="map-control-help">
              Shows how concentrated recorded incidents are geographically, regardless of population.
            </p>
          )}
        </div>

        <button className="map-reset-button" type="button" onClick={fitToCity} disabled={!mapReady}>
          Show whole {cityName}
        </button>
      </div>

      <div className="interactive-map-wrap">
        <div ref={containerRef} className="interactive-city-map" />

        <div className="map-area-finder">
          <label htmlFor="area-map-search">Find a neighbourhood</label>
          <div>
            <input
              id="area-map-search"
              list="area-map-options"
              value={areaSearch}
              onChange={(event) => setAreaSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  findArea();
                }
              }}
              placeholder="e.g. Sol, Lavapiés, Camden…"
            />
            <button type="button" onClick={findArea} disabled={!mapReady}>Find</button>
          </div>
          <datalist id="area-map-options">
            {areas.map((area) => <option value={area.name} key={area.id} />)}
          </datalist>
        </div>

        <div className="map-tap-hint">Tap or click an area for details</div>

        {selectedArea ? (
          <aside className="map-selection-card">
            <button
              type="button"
              className="map-selection-close"
              onClick={() => setSelectedAreaId(null)}
              aria-label="Close selected area"
            >
              ×
            </button>
            <span>{citySlug === "madrid" ? "Municipal neighbourhood" : "Police neighbourhood"}</span>
            <h3>{selectedArea.name}</h3>

            <div className="map-selection-summary">
              <strong>{relativeBand(selectedMetric.percentile)}</strong>
              <p>
                {selectedPercentile !== null
                  ? `Higher recorded level than about ${selectedPercentile}% of ${cityName} areas for this metric.`
                  : "There is no comparable city percentile for this area."}
              </p>
            </div>

            {selectedPercentile !== null ? (
              <div className="map-relative-scale" aria-label={`Relative position: ${selectedPercentile}%`}>
                <div className="map-relative-track">
                  <i style={{ left: `${Math.min(100, Math.max(0, selectedPercentile))}%` }} />
                </div>
                <div><span>Lower</span><span>Higher</span></div>
              </div>
            ) : null}

            <dl>
              <div>
                <dt>Selected rate</dt>
                <dd>{formatMetric(selectedMetric.value, selectedMetric.unit)}</dd>
              </div>
              <div>
                <dt>Recorded incidents</dt>
                <dd>{selectedMetric.count?.toLocaleString("en-GB") ?? "—"}</dd>
              </div>
              {selectedBaseMetric?.population ? (
                <div>
                  <dt>Registered residents</dt>
                  <dd>{selectedBaseMetric.population.toLocaleString("en-GB")}</dd>
                </div>
              ) : null}
              {selectedActivity ? (
                <div>
                  <dt>Open premises</dt>
                  <dd>{selectedActivity.openPremises.toLocaleString("en-GB")}</dd>
                </div>
              ) : null}
              <div>
                <dt>Snapshot</dt>
                <dd>{formatMonth(selectedBaseMetric?.month)}</dd>
              </div>
            </dl>

            {selectedActivity ? (
              <p className="map-context-note">
                Commercial census is shown only as local context; it is not used as a risk denominator.
              </p>
            ) : null}

            <a className="map-selection-link" href={areaHref(selectedArea.id)}>
              Open full area profile →
            </a>
          </aside>
        ) : null}

        {!mapReady && !mapError ? <div className="map-loading">Loading map…</div> : null}
        {mapError ? <div className="map-loading map-error">{mapError}</div> : null}
      </div>

      <div className="map-legend-block" aria-label="Map legend">
        <div className="map-legend-title">
          <strong>Relative recorded level in {cityName}</strong>
          <span>Same metric · same snapshot</span>
        </div>
        <div className="map-legend-bands">
          <div><i className="legend-q1" /><span>Lowest 20%</span></div>
          <div><i className="legend-q2" /><span>Lower</span></div>
          <div><i className="legend-q3" /><span>Middle</span></div>
          <div><i className="legend-q4" /><span>Higher</span></div>
          <div><i className="legend-q5" /><span>Highest 20%</span></div>
        </div>
      </div>

      <div className="map-meaning-strip">
        <div>
          <strong>Darker ≠ more dangerous</strong>
          <span>It only means a higher recorded level for the selected metric.</span>
        </div>
        <div>
          <strong>Compare within the city</strong>
          <span>Colours are recalculated against other {cityName} areas, not against another city.</span>
        </div>
        <div>
          <strong>Use the profile for context</strong>
          <span>Open an area to see category mix, trend, source and limitations.</span>
        </div>
      </div>

      <p className="density-caution map-method-note">
        The map uses official source data and a neutral five-band relative scale. It is descriptive, not a personal-risk prediction.
        The basemap is © OpenStreetMap contributors, rendered via OpenFreeMap.
      </p>
    </section>
  );
}
