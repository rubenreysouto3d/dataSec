"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { areaHref } from "@/lib/area-route";
import type {
  CityActivityContext,
  CityBoundary,
  CityMapMetric,
  CitySafetySignal,
  CitySlug,
  Neighbourhood,
} from "@/lib/data";

type Props = {
  citySlug: CitySlug;
  areas: Neighbourhood[];
  boundaries: CityBoundary[];
  metrics: CityMapMetric[];
  activityContexts: CityActivityContext[];
  safetySignals: CitySafetySignal[];
};

type AudienceKey = "resident" | "visitor";
type MetricKey = "contextual-overview" | "visitor-context" | "residential-harm" | "violence-property" | "theft" | "crime-related" | "activity";
type NormalizationKey = "density" | "resident";
type LayerKey =
  | "contextual-overview"
  | "visitor-context"
  | "residential-harm"
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
  "contextual-overview": {
    label: "Resident context",
    short: "Resident context",
    note: "Longer-term residential context. Madrid combines six-month personal-harm position with residents’ night-safety perception; other cities fall back to the best comparable recorded metric available.",
  },
  "visitor-context": {
    label: "Visitor context",
    short: "Visitor context",
    note: "Short-stay context weighted toward theft and robbery, with a smaller violence/property component. It uses area concentration rather than registered residents.",
  },
  "residential-harm": {
    label: "Personal harm · recent history",
    short: "Personal harm · recent history",
    note: "Madrid signal using available recent months of violence, aggression, violent robbery, family/gender violence and closely related dispatch categories, normalised by registered residents.",
  },
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
  if (metric === "contextual-overview") return "contextual-overview";
  if (metric === "visitor-context") return "visitor-context";
  if (metric === "residential-harm") return "residential-harm";
  if (normalization === "resident" && metric !== "activity") {
    return `${metric}-resident` as LayerKey;
  }
  return metric;
}

function metricForLayer(
  metric: CityMapMetric | undefined,
  layer: LayerKey,
  safetySignal?: CitySafetySignal,
) {
  if (layer === "contextual-overview") {
    const fallbackPercentile =
      metric?.violencePropertyResidentPercentile ??
      metric?.violencePropertyDensityPercentile ??
      null;
    return {
      percentile: safetySignal?.contextualConcernPercentile ?? fallbackPercentile,
      value: null,
      count: safetySignal?.personalHarmCount ?? metric?.violencePropertyCount ?? null,
      unit: "",
    };
  }
  if (layer === "visitor-context") {
    const theft = metric?.theftDensityPercentile;
    const violence = metric?.violencePropertyDensityPercentile;
    const percentile =
      theft !== null && theft !== undefined && violence !== null && violence !== undefined
        ? theft * 0.7 + violence * 0.3
        : theft ?? violence ?? null;
    return {
      percentile,
      value: null,
      count: metric ? metric.theftCount + metric.violencePropertyCount : null,
      unit: "",
    };
  }
  if (layer === "residential-harm") {
    return {
      percentile: safetySignal?.residentPercentile ?? null,
      value: safetySignal?.personalHarmPer10k ?? null,
      count: safetySignal?.personalHarmCount ?? null,
      unit: "/10k residents / month",
    };
  }
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

function colorForPercentile(percentile: number | null) {
  if (percentile === null || !Number.isFinite(percentile)) return "#c8c6bf";
  if (percentile < 0.2) return "#3f9b63";
  if (percentile < 0.4) return "#8ab85b";
  if (percentile < 0.6) return "#dfc64c";
  if (percentile < 0.8) return "#e28a43";
  return "#c84c3f";
}

function fallbackPath(boundary: CityBoundary, bounds: Bounds) {
  const width = 1000;
  const height = 700;
  const padding = 24;
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const midLat = (minLat + maxLat) / 2;
  const lonFactor = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const geoWidth = Math.max((maxLng - minLng) * lonFactor, 0.000001);
  const geoHeight = Math.max(maxLat - minLat, 0.000001);
  const scale = Math.min(
    (width - padding * 2) / geoWidth,
    (height - padding * 2) / geoHeight,
  );
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const project = (longitude: number, latitude: number) => {
    const x = width / 2 + (longitude - centerLng) * lonFactor * scale;
    const y = height / 2 - (latitude - centerLat) * scale;
    return [x, y] as const;
  };

  return boundary.rings
    .map((ring) =>
      ring
        .map((point, index) => {
          const [x, y] = project(Number(point.longitude), Number(point.latitude));
          return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ") + " Z",
    )
    .join(" ");
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
  if (percentile < 0.6) return "Around the city middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "Highest 20% of areas";
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianComparison(value: number | null, cityMedian: number | null) {
  if (value === null || cityMedian === null || !Number.isFinite(value) || !Number.isFinite(cityMedian)) {
    return "No median comparison";
  }
  if (cityMedian === 0) return value === 0 ? "At the city median" : "Above the city median";
  const delta = ((value - cityMedian) / cityMedian) * 100;
  if (Math.abs(delta) < 8) return "Close to the city median";
  return `${Math.round(Math.abs(delta))}% ${delta > 0 ? "above" : "below"} the city median`;
}

export default function CityMap({ citySlug, areas, boundaries, metrics, activityContexts, safetySignals }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const residentCoverage = metrics.filter((metric) => metric.population !== null).length;
  const hasResidentLayer = residentCoverage >= Math.max(1, Math.floor(areas.length * 0.8));
  const hasReliableSafetySignal = safetySignals.some((signal) => signal.months >= 3);
  const hasContextualOverview = safetySignals.some(
    (signal) => signal.months >= 3 && signal.contextualConcernPercentile !== null,
  );
  const [audience, setAudience] = useState<AudienceKey>("resident");
  const [layer, setLayer] = useState<LayerKey>(() => {
    if (citySlug === "madrid" && hasContextualOverview) return "contextual-overview";
    if (hasResidentLayer) return "violence-property-resident";
    return "violence-property";
  });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");

  const cityName = citySlug === "madrid" ? "Madrid" : "London";
  const safetyWindowMonths = safetySignals.reduce((max, signal) => Math.max(max, signal.months), 0);
  const safetyWindowLabel = safetyWindowMonths
    ? `${safetyWindowMonths} month${safetyWindowMonths === 1 ? "" : "s"}`
    : "recent history";
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
  const safetySignalById = useMemo(
    () => new Map(safetySignals.map((signal) => [signal.areaId, signal])),
    [safetySignals],
  );

  const bounds = useMemo<Bounds | null>(() => {
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
      const selected = metricForLayer(
        metricById.get(boundary.areaId),
        layer,
        safetySignalById.get(boundary.areaId),
      );
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
  }, [areaById, boundaries, layer, metricById, safetySignalById]);

  const fallbackShapes = useMemo(() => {
    if (!bounds) return [];
    return boundaries.flatMap((boundary) => {
      const area = areaById.get(boundary.areaId);
      if (!area) return [];
      const selected = metricForLayer(
        metricById.get(boundary.areaId),
        layer,
        safetySignalById.get(boundary.areaId),
      );
      return [{
        id: area.id,
        name: area.name,
        path: fallbackPath(boundary, bounds),
        fill: colorForPercentile(selected.percentile),
        selected: area.id === selectedAreaId,
      }];
    });
  }, [areaById, boundaries, bounds, layer, metricById, safetySignalById, selectedAreaId]);

  const cityMedian = useMemo(() => {
    const values = metrics
      .map((metric) => metricForLayer(metric, layer, safetySignalById.get(metric.areaId)).value)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    return median(values);
  }, [layer, metrics, safetySignalById]);

  const selectedArea = selectedAreaId ? areaById.get(selectedAreaId) ?? null : null;
  const selectedBaseMetric = selectedAreaId ? metricById.get(selectedAreaId) : undefined;
  const selectedActivity = selectedAreaId ? activityById.get(selectedAreaId) : undefined;
  const selectedSafetySignal = selectedAreaId ? safetySignalById.get(selectedAreaId) : undefined;
  const selectedMetric = metricForLayer(selectedBaseMetric, layer, selectedSafetySignal);
  const selectedPercentile =
    selectedMetric.percentile !== null && Number.isFinite(selectedMetric.percentile)
      ? Math.round(selectedMetric.percentile * 100)
      : null;

  function chooseAudience(nextAudience: AudienceKey) {
    setAudience(nextAudience);
    if (nextAudience === "visitor") {
      setLayer("visitor-context");
      return;
    }
    if (citySlug === "madrid" && hasContextualOverview) {
      setLayer("contextual-overview");
      return;
    }
    setLayer(hasResidentLayer ? "violence-property-resident" : "violence-property");
  }

  function chooseMetric(nextMetric: MetricKey) {
    if (nextMetric === "contextual-overview") {
      setAudience("resident");
      setLayer("contextual-overview");
      return;
    }
    if (nextMetric === "visitor-context") {
      setAudience("visitor");
      setLayer("visitor-context");
      return;
    }
    if (nextMetric === "residential-harm") {
      setLayer("residential-harm");
      return;
    }
    const nextNormalization =
      normalization === "resident" && nextMetric !== "activity" && hasResidentLayer
        ? "resident"
        : "density";
    setLayer(layerFor(nextMetric, nextNormalization));
  }

  function chooseNormalization(nextNormalization: NormalizationKey) {
    if (metricKey === "contextual-overview" || metricKey === "visitor-context" || metricKey === "residential-harm") return;
    if (nextNormalization === "resident" && (!hasResidentLayer || metricKey === "activity")) return;
    setLayer(layerFor(metricKey, nextNormalization));
  }

  function focusArea(areaId: string) {
    const boundary = boundaryById.get(areaId);
    const area = areaById.get(areaId);
    if (!boundary || !area) return;
    setSelectedAreaId(areaId);
    setAreaSearch(area.name);

    if (!mapRef.current) return;
    const itemBounds = boundaryBounds(boundary);
    if (!itemBounds) return;
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
        const maplibre = await Promise.race([
          loadMapLibre(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("MapLibre load timeout")), 8000),
          ),
        ]);
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
        const mapLoadTimeout = window.setTimeout(() => {
          if (!cancelled && !map.loaded()) {
            setMapError("Interactive basemap unavailable — showing the data map instead.");
          }
        }, 10000);

        map.addControl(new maplibre.NavigationControl({ visualizePitch: false }), "top-right");
        map.addControl(new maplibre.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
        popupRef.current = new maplibre.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          maxWidth: "300px",
        });

        map.on("load", () => {
          window.clearTimeout(mapLoadTimeout);
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
                  "#3f9b63",
                  0.2, "#8ab85b",
                  0.4, "#dfc64c",
                  0.6, "#e28a43",
                  0.8, "#c84c3f",
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
    ...(citySlug === "madrid" && hasContextualOverview
      ? [{ key: "contextual-overview" as MetricKey, label: "Resident context" }]
      : []),
    { key: "visitor-context", label: "Visitor context" },
    ...(citySlug === "madrid" && hasReliableSafetySignal
      ? [{ key: "residential-harm" as MetricKey, label: `Personal harm · ${safetyWindowLabel}` }]
      : []),
    { key: "violence-property", label: "Violence + property" },
    { key: "theft", label: "Theft + robbery" },
    { key: "crime-related", label: "All crime-related" },
    { key: "activity", label: citySlug === "madrid" ? "All police activity" : "All source activity" },
  ];

  return (
    <section className="city-map-panel interactive-map-panel">
      <div className="map-audience-switch">
        <div>
          <span>WHO IS THIS FOR?</span>
          <strong>Choose how you will use the area</strong>
        </div>
        <div className="map-audience-buttons" role="group" aria-label="Map audience">
          <button
            type="button"
            className={audience === "resident" ? "is-active" : ""}
            aria-pressed={audience === "resident"}
            onClick={() => chooseAudience("resident")}
          >
            <strong>Resident</strong>
            <small>Living here · recurring exposure</small>
          </button>
          <button
            type="button"
            className={audience === "visitor" ? "is-active" : ""}
            aria-pressed={audience === "visitor"}
            onClick={() => chooseAudience("visitor")}
          >
            <strong>Visitor</strong>
            <small>Tourism · short stay · street exposure</small>
          </button>
        </div>
      </div>

      <div className="map-understand-head">
        <div className="map-title-block">
          <span>INTERACTIVE MAP · {formatMonth(latestMonth)}</span>
          <h2>{metricCopy[metricKey].label}</h2>
          <p>{metricCopy[metricKey].note}</p>
        </div>

        <div className="map-reading-card">
          <strong>How to read this map</strong>
          <p>
            {metricKey === "contextual-overview"
              ? "Green means lower relative residential concern; red means higher. Madrid combines six-month personal harm with resident perception."
              : metricKey === "visitor-context"
                ? "Green means lower relative visitor exposure; red means higher. This view prioritises theft and robbery hotspots, then violence/property concentration."
                : `Green means a lower relative recorded level and red a higher one for this metric across ${cityName}. Colours are comparative, not guarantees of safety.`}
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
          {metricKey === "contextual-overview" ? (
            <>
              <div className="map-signal-definition map-overview-definition">
                <strong>Two independent official signals</strong>
                <small>50% neighbourhood harm position · 50% district night-safety perception</small>
              </div>
              <p className="map-control-help">
                This separates persistent residential concern from central activity hotspots. Survey perception is district-level, not neighbourhood-level.
              </p>
            </>
          ) : metricKey === "visitor-context" ? (
            <>
              <div className="map-signal-definition map-visitor-definition">
                <strong>Street-exposure view</strong>
                <small>70% theft + robbery concentration · 30% violence/property concentration</small>
              </div>
              <p className="map-control-help">
                Uses incidents per km² rather than registered population, because visitors are not represented in resident denominators.
              </p>
            </>
          ) : metricKey === "residential-harm" ? (
            <>
              <div className="map-signal-definition">
                <strong>Rolling resident rate</strong>
                <small>{safetyWindowLabel} · average monthly records per 10,000 registered residents</small>
              </div>
              <p className="map-control-help">
                Uses up to six available months to reduce one-month noise. Theft without violence, traffic and administrative activity are excluded.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        <button className="map-reset-button" type="button" onClick={fitToCity} disabled={!mapReady}>
          Show whole {cityName}
        </button>
      </div>

      <div className="map-current-view">
        <strong>Currently showing</strong>
        <span>
          {metricKey === "contextual-overview"
            ? "Resident context"
            : metricKey === "visitor-context"
              ? "Visitor context"
            : metricKey === "residential-harm"
              ? `Personal harm · ${safetyWindowLabel}`
              : metricCopy[metricKey].short} · {metricKey === "contextual-overview"
            ? "harm + resident perception"
            : metricKey === "visitor-context"
              ? "theft/robbery + violence concentration"
            : metricKey === "residential-harm"
              ? "rolling resident rate"
            : normalization === "resident"
              ? "per 10,000 residents"
              : "per km²"} · relative to other {cityName} areas
        </span>
      </div>

      <div className="map-stage">
        <div className="interactive-map-wrap">
          {!mapReady && bounds ? (
            <svg
              className="datasec-fallback-map"
              viewBox="0 0 1000 700"
              role="img"
              aria-label={`${cityName} neighbourhood data map`}
              preserveAspectRatio="xMidYMid meet"
            >
              <rect width="1000" height="700" className="datasec-fallback-bg" />
              <g>
                {fallbackShapes.map((shape) => (
                  <path
                    key={shape.id}
                    d={shape.path}
                    fill={shape.fill}
                    className={shape.selected ? "is-selected" : ""}
                    onClick={() => focusArea(shape.id)}
                  >
                    <title>{shape.name}</title>
                  </path>
                ))}
              </g>
            </svg>
          ) : null}
          <div ref={containerRef} className={`interactive-city-map ${mapReady ? "is-ready" : ""}`} />

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

          {!mapReady && !mapError ? (
            <div className="map-fallback-status">Loading interactive basemap…</div>
          ) : null}
          {mapError ? <div className="map-fallback-status map-error">{mapError}</div> : null}
        </div>

        <aside className="map-detail-panel" aria-live="polite">
          {selectedArea ? (
            <div className="map-selection-card">
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
                  {metricKey === "contextual-overview"
                    ? "Residential context from recorded personal harm and resident night-safety perception."
                    : metricKey === "visitor-context"
                      ? "Visitor-oriented position from theft/robbery and violence/property concentration."
                      : medianComparison(selectedMetric.value, cityMedian)}
                </p>
              </div>

              {metricKey === "contextual-overview" && selectedSafetySignal ? (
                <div className="map-overview-components">
                  <div>
                    <span>Recorded personal harm</span>
                    <strong>{relativeBand(selectedSafetySignal.residentPercentile)}</strong>
                    <small>
                      {formatMetric(selectedSafetySignal.personalHarmPer10k, "/10k residents / month")} · {selectedSafetySignal.months} months
                    </small>
                  </div>
                  <div>
                    <span>Resident perception at night</span>
                    <strong>
                      {selectedSafetySignal.districtNightSafety !== null
                        ? `${selectedSafetySignal.districtNightSafety.toFixed(1)}/10`
                        : "Unavailable"}
                    </strong>
                    <small>{selectedSafetySignal.districtName ?? "District unavailable"} · 2025 survey</small>
                  </div>
                </div>
              ) : metricKey === "visitor-context" && selectedBaseMetric ? (
                <div className="map-overview-components">
                  <div>
                    <span>Theft + robbery</span>
                    <strong>{relativeBand(selectedBaseMetric.theftDensityPercentile)}</strong>
                    <small>{formatMetric(selectedBaseMetric.theftPerKm2, "/km²")} · latest snapshot</small>
                  </div>
                  <div>
                    <span>Violence + property</span>
                    <strong>{relativeBand(selectedBaseMetric.violencePropertyDensityPercentile)}</strong>
                    <small>{formatMetric(selectedBaseMetric.violencePropertyPerKm2, "/km²")} · latest snapshot</small>
                  </div>
                </div>
              ) : (
                <div className="map-value-compare">
                  <div>
                    <span>This area</span>
                    <strong>{formatMetric(selectedMetric.value, selectedMetric.unit)}</strong>
                  </div>
                  <div>
                    <span>City median</span>
                    <strong>{formatMetric(cityMedian, selectedMetric.unit)}</strong>
                  </div>
                </div>
              )}

              {selectedPercentile !== null ? (
                <div className="map-relative-scale" aria-label={`Relative position: ${selectedPercentile}%`}>
                  <div className="map-relative-track">
                    <b aria-hidden="true" />
                    <i style={{ left: `${Math.min(100, Math.max(0, selectedPercentile))}%` }} />
                  </div>
                  <div><span>Lower</span><span>City middle</span><span>Higher</span></div>
                </div>
              ) : null}

              <p className="map-percentile-copy">
                {selectedPercentile !== null
                  ? metricKey === "contextual-overview"
                    ? `This residential context is higher-concern than about ${selectedPercentile}% of Madrid neighbourhoods.`
                    : metricKey === "visitor-context"
                      ? `This visitor-oriented signal is higher than about ${selectedPercentile}% of ${cityName} areas.`
                      : `About ${selectedPercentile}% of ${cityName} areas recorded a lower value for this exact metric.`
                  : "There is no comparable city percentile for this area."}
              </p>

              <dl>
                <div>
                  <dt>{metricKey === "contextual-overview" || metricKey === "residential-harm" ? "Personal-harm records in window" : metricKey === "visitor-context" ? "Relevant recorded incidents" : "Recorded incidents"}</dt>
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
                  <dt>{metricKey === "contextual-overview" || metricKey === "residential-harm" ? "Window" : "Snapshot"}</dt>
                  <dd>
                    {(metricKey === "contextual-overview" || metricKey === "residential-harm") && selectedSafetySignal
                      ? `${formatMonth(selectedSafetySignal.monthStart)}–${formatMonth(selectedSafetySignal.monthEnd)}`
                      : formatMonth(selectedBaseMetric?.month)}
                  </dd>
                </div>
              </dl>

              {selectedActivity ? (
                <p className="map-context-note">
                  Commercial census is shown only as local context; it is not used as a risk denominator.
                </p>
              ) : null}

              <div className="map-selection-actions">
                <a className="map-selection-link" href={areaHref(selectedArea.id)}>
                  Open full area profile →
                </a>
                <a className="map-selection-compare" href={`/compare?a=${encodeURIComponent(selectedArea.id)}`}>
                  Compare this area
                </a>
              </div>
            </div>
          ) : (
            <div className="map-empty-detail">
              <span>AREA DETAILS</span>
              <h3>Select a neighbourhood</h3>
              <p>Tap a coloured area or use the search box. This panel will explain the result against the city median and the rest of the city.</p>
              <div className="map-empty-example">
                <strong>Colour answers one question:</strong>
                <span>“How high is this recorded value compared with other areas in the same city?”</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="map-legend-block" aria-label="Map legend">
        <div className="map-legend-title">
          <strong>
            {metricKey === "contextual-overview"
              ? "Resident context"
              : metricKey === "visitor-context"
                ? "Visitor context"
                : `Relative recorded level in ${cityName}`}
          </strong>
          <span>
            {metricKey === "contextual-overview"
              ? "Lower concern → higher concern"
              : metricKey === "visitor-context"
                ? "Lower visitor exposure → higher visitor exposure"
                : "Lower recorded level → higher recorded level"}
          </span>
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
          <strong>Green ≠ guaranteed safe · red ≠ automatically dangerous</strong>
          <span>
            {metricKey === "contextual-overview"
              ? "Colour summarises relative residential concern from the available official signals."
              : metricKey === "visitor-context"
                ? "Colour summarises relative visitor exposure to the selected incident mix."
                : "Colour only shows a lower or higher recorded level for the selected metric."}
          </span>
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
        {metricKey === "contextual-overview"
          ? " The overview gives equal weight to neighbourhood personal-harm position and the 2025 district-level resident night-safety survey."
          : ""}
        The basemap is © OpenStreetMap contributors, rendered via OpenFreeMap.
      </p>
    </section>
  );
}
