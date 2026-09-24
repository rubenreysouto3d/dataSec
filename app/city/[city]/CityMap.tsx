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
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const layerCopy: Record<LayerKey, { label: string; note: string }> = {
  "violence-property": {
    label: "Violence & property",
    note: "Selected violence and property-related source categories per km².",
  },
  theft: {
    label: "Theft & robbery",
    note: "Theft, robbery and vehicle/property-theft categories per km².",
  },
  "crime-related": {
    label: "Crime-related",
    note: "Crime-related source categories per km². London anti-social behaviour and Madrid non-crime dispatch activity are excluded.",
  },
  activity: {
    label: "All source activity",
    note: "All source incidents per km², including non-crime Madrid police dispatch activity.",
  },
  "violence-property-resident": {
    label: "Violence & property / 10k residents",
    note: "Selected violence and property-related categories per 10,000 registered residents. Visitor-heavy centres can be overstated.",
  },
  "theft-resident": {
    label: "Theft & robbery / 10k residents",
    note: "Theft, robbery and vehicle/property-theft categories per 10,000 registered residents. Visitor-heavy centres can be overstated.",
  },
  "crime-related-resident": {
    label: "Crime-related / 10k residents",
    note: "Crime-related source categories per 10,000 registered residents. Visitor-heavy centres can be overstated.",
  },
};

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
  if (document.querySelector(`link[data-datasec-maplibre]`)) return;
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
          const firstLabelLayer = map.getStyle().layers?.find((styleLayer: any) => styleLayer.type === "symbol")?.id;

          map.addLayer({
            id: "datasec-areas-fill",
            type: "fill",
            source: "datasec-areas",
            paint: {
              "fill-color": [
                "case",
                ["==", ["get", "percentile"], null],
                "#b8b6af",
                [
                  "interpolate",
                  ["linear"],
                  ["to-number", ["get", "percentile"]],
                  0, "#dce9f2",
                  0.25, "#9ecae1",
                  0.5, "#4292c6",
                  0.75, "#1361a8",
                  1, "#08306b",
                ],
              ],
              "fill-opacity": 0.7,
            },
          }, firstLabelLayer);
          map.addLayer({
            id: "datasec-areas-line",
            type: "line",
            source: "datasec-areas",
            paint: {
              "line-color": "rgba(255,255,255,.92)",
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
            const valueText = Number.isFinite(value)
              ? `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${props.unit ?? ""}`
              : "No value";
            const percentileText = Number.isFinite(percentile)
              ? ` · P${Math.round(percentile * 100)}`
              : "";
            detail.textContent = `${valueText}${percentileText}`;
            const hint = document.createElement("small");
            hint.textContent = "Click to inspect this area";
            card.append(title, detail, hint);
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

  const layers: Array<{ key: LayerKey; label: string }> = [
    { key: "violence-property", label: "Violence & property · density" },
    { key: "theft", label: "Theft & robbery · density" },
    { key: "crime-related", label: "Crime-related · density" },
    { key: "activity", label: "All source activity · density" },
  ];

  if (hasResidentLayer) {
    layers.unshift(
      { key: "violence-property-resident", label: "Violence & property · residents" },
      { key: "theft-resident", label: "Theft & robbery · residents" },
      { key: "crime-related-resident", label: "Crime-related · residents" },
    );
  }

  return (
    <section className="city-map-panel interactive-map-panel">
      <div className="panel-head map-panel-head">
        <div>
          <span>INTERACTIVE MAP</span>
          <h2>{layerCopy[layer].label}</h2>
          <p>{layerCopy[layer].note}</p>
        </div>
        <div className="map-layer-tools">
          <label>
            <span>Map layer</span>
            <select
              value={layer}
              onChange={(event) => setLayer(event.target.value as LayerKey)}
            >
              {layers.map((item) => (
                <option value={item.key} key={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={fitToCity} disabled={!mapReady}>
            Reset view
          </button>
        </div>
      </div>

      <div className="interactive-map-wrap">
        <div ref={containerRef} className="interactive-city-map" />

        <div className="map-area-finder">
          <label htmlFor="area-map-search">Find an area</label>
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
              placeholder="Neighbourhood name"
            />
            <button type="button" onClick={findArea} disabled={!mapReady}>Find</button>
          </div>
          <datalist id="area-map-options">
            {areas.map((area) => <option value={area.name} key={area.id} />)}
          </datalist>
        </div>

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
            <div className="map-selection-metric">
              <strong>{formatMetric(selectedMetric.value, selectedMetric.unit)}</strong>
              <small>
                {selectedMetric.percentile !== null
                  ? "P" + Math.round(selectedMetric.percentile * 100) + " within this city"
                  : "No percentile available"}
              </small>
            </div>
            <dl>
              <div>
                <dt>Recorded in layer</dt>
                <dd>{selectedMetric.count?.toLocaleString("en-GB") ?? "—"}</dd>
              </div>
              {selectedBaseMetric?.population ? (
                <div>
                  <dt>Registered residents</dt>
                  <dd>{selectedBaseMetric.population.toLocaleString("en-GB")}</dd>
                </div>
              ) : null}
              {selectedActivity ? (
                <>
                  <div>
                    <dt>Open premises</dt>
                    <dd>{selectedActivity.openPremises.toLocaleString("en-GB")}</dd>
                  </div>
                  <div>
                    <dt>Open hostelry</dt>
                    <dd>{selectedActivity.openHostelry.toLocaleString("en-GB")}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Snapshot</dt>
                <dd>{selectedBaseMetric?.month ?? "—"}</dd>
              </div>
            </dl>
            {selectedActivity ? (
              <p className="map-context-note">
                Commercial census · context only, not a risk denominator.
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

      <div className="map-legend map-legend-interactive" aria-label="Map legend">
        <span>Lower recorded level</span>
        <i className="legend-1" />
        <i className="legend-2" />
        <i className="legend-3" />
        <i className="legend-4" />
        <i className="legend-5" />
        <span>Higher recorded level</span>
      </div>

      <p className="density-caution map-method-note">
        Colour shows the percentile for the selected source-derived metric within this city and snapshot.
        Darker does not mean “dangerous” and lighter does not mean “safe”. The basemap is © OpenStreetMap contributors, rendered via OpenFreeMap.
        {hasResidentLayer
          ? layer.endsWith("-resident")
            ? " This resident-normalised view uses registered population; central visitor/nightlife areas can look artificially high because visitors are not in that denominator."
            : " Resident-normalised alternatives are available in the layer selector."
          : " Resident-normalised layers will appear when matched population data is available."}
      </p>
    </section>
  );
}
