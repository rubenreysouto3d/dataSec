"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { areaHref } from "@/lib/area-route";
import { locateAreaByCoordinates, resolvePlaceToArea } from "@/lib/public-data-client";
import { cityNames } from "@/lib/data";
import {
  buildVisitorPercentileMap,
  CITY_FILTER_METHODS,
  MAP_ADVANCED_FILTERS,
  MAP_AUDIENCES,
  MAP_COLOR_BANDS,
  type MapAudienceKey,
  type MapAdvancedFilterKey,
} from "@/lib/map-filters";
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

type AudienceKey = MapAudienceKey | "advanced";
type MetricKey = "contextual-overview" | "visitor-context" | "residential-harm" | MapAdvancedFilterKey;
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
    note: "Residential context using the best official signals available for this city. The percentile is local to this city and is not a cross-city score.",
  },
  "visitor-context": {
    label: "Visitor context",
    short: "Visitor context",
    note: "Short-stay context weighted toward theft and robbery, with a smaller violence/property component. It uses area concentration rather than registered residents. The percentile is local to this city.",
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
    note: "Crime-related categories mapped from the city’s official source; non-crime activity is excluded when the source contains it.",
  },
  activity: {
    label: "All source activity",
    short: "All activity",
    note: "Everything in the city’s official source, including non-crime activity when that source contains it.",
  },
};

function methodForMetric(
  metricKey: MetricKey,
  methods: (typeof CITY_FILTER_METHODS)[CitySlug],
  residentMethod: string,
  visitorMethod: string,
) {
  if (metricKey === "contextual-overview") return residentMethod;
  if (metricKey === "visitor-context") return visitorMethod;
  if (metricKey === "violence-property") return methods.violencePropertyMethod;
  if (metricKey === "theft") return methods.theftMethod;
  if (metricKey === "crime-related") return methods.crimeRelatedMethod;
  return methods.activityMethod;
}

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
  visitorPercentile?: number | null,
) {
  if (layer === "contextual-overview") {
    const hasResidentValue =
      metric?.violencePropertyResidentPercentile !== null &&
      metric?.violencePropertyResidentPercentile !== undefined &&
      metric?.violencePropertyPer10k !== null &&
      metric?.violencePropertyPer10k !== undefined;
    const fallbackPercentile =
      metric?.violencePropertyResidentPercentile ??
      metric?.violencePropertyDensityPercentile ??
      null;
    return {
      percentile: safetySignal?.contextualConcernPercentile ?? fallbackPercentile,
      value: safetySignal?.contextualConcernPercentile !== null &&
        safetySignal?.contextualConcernPercentile !== undefined
        ? null
        : hasResidentValue
          ? metric?.violencePropertyPer10k ?? null
          : metric?.violencePropertyPerKm2 ?? null,
      count: safetySignal?.personalHarmCount ?? metric?.violencePropertyCount ?? null,
      unit: safetySignal?.contextualConcernPercentile !== null &&
        safetySignal?.contextualConcernPercentile !== undefined
        ? ""
        : hasResidentValue
          ? "/10k residents"
          : "/km²",
    };
  }
  if (layer === "visitor-context") {
    return {
      percentile: visitorPercentile ?? null,
      value: null,
      count: null,
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
  return MAP_COLOR_BANDS.find((band) => percentile < band.max)?.color ?? MAP_COLOR_BANDS.at(-1)!.color;
}

const MAP_COLOR_STYLE = {
  "--map-q1": MAP_COLOR_BANDS[0].color,
  "--map-q2": MAP_COLOR_BANDS[1].color,
  "--map-q3": MAP_COLOR_BANDS[2].color,
  "--map-q4": MAP_COLOR_BANDS[3].color,
  "--map-q5": MAP_COLOR_BANDS[4].color,
} as CSSProperties;

const MAP_FILL_COLOR_EXPRESSION = [
  "case",
  ["==", ["get", "percentile"], null],
  "#c8c6bf",
  [
    "step",
    ["to-number", ["get", "percentile"]],
    MAP_COLOR_BANDS[0].color,
    MAP_COLOR_BANDS[0].max, MAP_COLOR_BANDS[1].color,
    MAP_COLOR_BANDS[1].max, MAP_COLOR_BANDS[2].color,
    MAP_COLOR_BANDS[2].max, MAP_COLOR_BANDS[3].color,
    MAP_COLOR_BANDS[3].max, MAP_COLOR_BANDS[4].color,
  ],
];

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

function relativeBand(
  percentile: number | null,
  mode: "resident" | "visitor" | "recorded" = "recorded",
) {
  if (percentile === null || !Number.isFinite(percentile)) return "No city comparison";

  if (mode === "resident") {
    if (percentile < 0.2) return "Lowest residential concern";
    if (percentile < 0.4) return "Lower residential concern";
    if (percentile < 0.6) return "Around the city middle";
    if (percentile < 0.8) return "Higher residential concern";
    return "Highest residential concern";
  }

  if (mode === "visitor") {
    if (percentile < 0.2) return "Lowest visitor exposure";
    if (percentile < 0.4) return "Lower visitor exposure";
    if (percentile < 0.6) return "Around the city middle";
    if (percentile < 0.8) return "Higher visitor exposure";
    return "Highest visitor exposure";
  }

  if (percentile < 0.2) return "Lowest 20% of areas";
  if (percentile < 0.4) return "Lower than most areas";
  if (percentile < 0.6) return "Around the city middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "Highest 20% of areas";
}

function bandMode(metricKey: MetricKey): "resident" | "visitor" | "recorded" {
  if (metricKey === "contextual-overview") return "resident";
  if (metricKey === "visitor-context") return "visitor";
  return "recorded";
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
  const [layer, setLayer] = useState<LayerKey>("contextual-overview");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [finderStatus, setFinderStatus] = useState<"idle" | "searching" | "locating" | "error">("idle");
  const [finderMessage, setFinderMessage] = useState("");

  const cityName = cityNames[citySlug];
  const cityMethods = CITY_FILTER_METHODS[citySlug];
  const residentMethod =
    citySlug === "madrid" && hasContextualOverview
      ? "6-month personal harm + 2025 resident night-safety perception"
      : hasResidentLayer
        ? cityMethods.residentFallbackMethod
        : "violence + property density (population denominator unavailable)";
  const visitorMethod = "70% theft + robbery concentration · 30% violence + property concentration";

  const safetyWindowMonths = safetySignals.reduce((max, signal) => Math.max(max, signal.months), 0);
  const safetyWindowLabel = safetyWindowMonths
    ? `${safetyWindowMonths} month${safetyWindowMonths === 1 ? "" : "s"}`
    : "recent history";
  const metricKey = metricKeyForLayer(layer);
  const normalization = normalizationForLayer(layer);
  const currentMethod = methodForMetric(metricKey, cityMethods, residentMethod, visitorMethod);
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
  const visitorPercentileById = useMemo(
    () => buildVisitorPercentileMap(metrics),
    [metrics],
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
        visitorPercentileById.get(boundary.areaId),
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
          band: relativeBand(selected.percentile, bandMode(metricKey)),
          displayMode: bandMode(metricKey),
        },
        geometry: boundary.rings.length === 1
          ? { type: "Polygon", coordinates: [coordinates[0]] }
          : { type: "MultiPolygon", coordinates: coordinates.map((ring) => [ring]) },
      }];
    });

    return { type: "FeatureCollection", features };
  }, [areaById, boundaries, layer, metricById, safetySignalById, visitorPercentileById]);

  const fallbackShapes = useMemo(() => {
    if (!bounds) return [];
    return boundaries.flatMap((boundary) => {
      const area = areaById.get(boundary.areaId);
      if (!area) return [];
      const selected = metricForLayer(
        metricById.get(boundary.areaId),
        layer,
        safetySignalById.get(boundary.areaId),
        visitorPercentileById.get(boundary.areaId),
      );
      return [{
        id: area.id,
        name: area.name,
        path: fallbackPath(boundary, bounds),
        fill: colorForPercentile(selected.percentile),
        selected: area.id === selectedAreaId,
      }];
    });
  }, [areaById, boundaries, bounds, layer, metricById, safetySignalById, selectedAreaId, visitorPercentileById]);

  const cityMedian = useMemo(() => {
    const values = metrics
      .map((metric) => metricForLayer(
        metric,
        layer,
        safetySignalById.get(metric.areaId),
        visitorPercentileById.get(metric.areaId),
      ).value)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    return median(values);
  }, [layer, metrics, safetySignalById, visitorPercentileById]);

  const selectedArea = selectedAreaId ? areaById.get(selectedAreaId) ?? null : null;
  const selectedBaseMetric = selectedAreaId ? metricById.get(selectedAreaId) : undefined;
  const selectedActivity = selectedAreaId ? activityById.get(selectedAreaId) : undefined;
  const selectedSafetySignal = selectedAreaId ? safetySignalById.get(selectedAreaId) : undefined;
  const selectedMetric = metricForLayer(
    selectedBaseMetric,
    layer,
    selectedSafetySignal,
    selectedAreaId ? visitorPercentileById.get(selectedAreaId) : null,
  );
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
    setLayer("contextual-overview");
  }

  function chooseMetric(nextMetric: MetricKey) {
    if (nextMetric !== "contextual-overview" && nextMetric !== "visitor-context") {
      setAudience("advanced");
    }
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

  async function findArea() {
    const text = areaSearch.trim();
    const needle = text.toLocaleLowerCase();
    if (!needle || finderStatus === "searching" || finderStatus === "locating") return;

    setFinderMessage("");
    const exact = areas.find((area) => area.name.toLocaleLowerCase() === needle);
    const partial = areas.find((area) => area.name.toLocaleLowerCase().includes(needle));
    const match = exact ?? partial;
    if (match) {
      setFinderStatus("idle");
      focusArea(match.id);
      return;
    }

    setFinderStatus("searching");
    try {
      const place = await resolvePlaceToArea(text);
      if (!place) {
        setFinderStatus("error");
        setFinderMessage("No covered neighbourhood matched that place or address.");
        return;
      }

      if (place.citySlug === citySlug && areaById.has(place.id)) {
        focusArea(place.id);
        setFinderStatus("idle");
        setFinderMessage(`Matched ${place.matchedPlace}`);
        return;
      }

      window.location.href = areaHref(place.id);
    } catch {
      setFinderStatus("error");
      setFinderMessage("Place lookup is temporarily unavailable.");
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setFinderStatus("error");
      setFinderMessage("Location is not available in this browser.");
      return;
    }

    setFinderStatus("locating");
    setFinderMessage("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const place = await locateAreaByCoordinates(coords.latitude, coords.longitude);
          if (!place) {
            setFinderStatus("error");
            setFinderMessage("Your location is outside current dataSec coverage.");
            return;
          }

          if (place.citySlug === citySlug && areaById.has(place.id)) {
            focusArea(place.id);
            setFinderStatus("idle");
            setFinderMessage(`You are in ${place.name}.`);
            return;
          }

          window.location.href = areaHref(place.id);
        } catch {
          setFinderStatus("error");
          setFinderMessage("We could not match your location to an official boundary.");
        }
      },
      () => {
        setFinderStatus("error");
        setFinderMessage("Location permission was not available.");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  function fitToCity() {
    setSelectedAreaId(null);
    setAreaSearch("");
    if (!mapRef.current || !bounds) return;
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
              "fill-color": MAP_FILL_COLOR_EXPRESSION,
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
            const displayMode = String(props.displayMode ?? "recorded");
            detail.textContent =
              displayMode === "resident" || displayMode === "visitor"
                ? String(props.band ?? "No city comparison")
                : Number.isFinite(value)
                  ? `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${props.unit ?? ""}`
                  : String(props.band ?? "No value");

            const context = document.createElement("small");
            context.textContent = Number.isFinite(percentile)
              ? displayMode === "resident"
                ? `Residential concern is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
                : displayMode === "visitor"
                  ? `Visitor exposure is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
                  : `Recorded level is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
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

  const metricOptions = MAP_ADVANCED_FILTERS;

  return (
    <section className="city-map-panel interactive-map-panel explorer-map" style={MAP_COLOR_STYLE}>
      <div className="explorer-toolbar">
        <div className="explorer-mode">
          <span className="explorer-toolbar-label">View for</span>
          <div className="map-audience-buttons map-audience-buttons-compact" role="group" aria-label="Map audience">
            {MAP_AUDIENCES.map((item) => (
              <button
                type="button"
                key={item.key}
                className={audience === item.key ? "is-active" : ""}
                aria-pressed={audience === item.key}
                onClick={() => chooseAudience(item.key)}
              >
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
        </div>

        <details className="explorer-filter-menu">
          <summary>
            <span>Filter</span>
            <strong>{metricCopy[metricKey].short}</strong>
          </summary>
          <div className="explorer-filter-body">
            <div className="explorer-filter-section">
              <span>Metric · same choices in every city</span>
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

            {metricKey !== "contextual-overview" &&
            metricKey !== "visitor-context" &&
            metricKey !== "residential-harm" ? (
              <div className="explorer-filter-section">
                <span>Compare areas by</span>
                <div className="map-choice-row map-normalization-row" role="group" aria-label="Comparison basis">
                  <button
                    type="button"
                    className={normalization === "density" ? "is-active" : ""}
                    aria-pressed={normalization === "density"}
                    onClick={() => chooseNormalization("density")}
                  >
                    <strong>Area</strong>
                    <small>per km²</small>
                  </button>
                  <button
                    type="button"
                    className={normalization === "resident" ? "is-active" : ""}
                    aria-pressed={normalization === "resident"}
                    disabled={!hasResidentLayer || metricKey === "activity"}
                    onClick={() => chooseNormalization("resident")}
                  >
                    <strong>Residents</strong>
                    <small>per 10,000</small>
                  </button>
                </div>
              </div>
            ) : null}

            <small className="explorer-filter-method">Local to {cityName} · {currentMethod}</small>
          </div>
        </details>

        <div className="map-color-key explorer-color-key" aria-label={`Relative colour scale within ${cityName}`}>
          <span>Lower in {cityName}</span>
          <i />
          <span>Higher in {cityName}</span>
        </div>
      </div>

      <div className={`map-stage ${selectedArea ? "has-selection" : ""}`}>
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

          <div className="map-area-finder map-area-finder-simple">
            <label className="sr-only" htmlFor="area-map-search">Find a neighbourhood</label>
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
                placeholder="Neighbourhood, address or hotel…"
              />
              <button
                type="button"
                onClick={findArea}
                disabled={!bounds || finderStatus === "searching" || finderStatus === "locating"}
              >
                {finderStatus === "searching" ? "Matching…" : "Find"}
              </button>
              <button
                type="button"
                onClick={locateMe}
                disabled={finderStatus === "searching" || finderStatus === "locating"}
              >
                {finderStatus === "locating" ? "Locating…" : "Use my location"}
              </button>
            </div>
            {finderMessage ? (
              <small className={finderStatus === "error" ? "map-finder-error" : "map-finder-note"}>
                {finderMessage}
              </small>
            ) : null}
            <datalist id="area-map-options">
              {areas.map((area) => <option value={area.name} key={area.id} />)}
            </datalist>
          </div>

          <button className="map-city-reset" type="button" onClick={fitToCity}>
            Whole city
          </button>

          {!mapReady && !mapError ? (
            <div className="map-fallback-status">Loading interactive map…</div>
          ) : null}
          {mapError ? <div className="map-fallback-status map-error">{mapError}</div> : null}
        </div>

        {selectedArea ? (
          <aside className="map-detail-panel" aria-live="polite">
            <div className="map-selection-card">
              <button
                type="button"
                className="map-selection-close"
                onClick={() => setSelectedAreaId(null)}
                aria-label="Close selected area"
              >
                ×
              </button>

              <span className="map-selection-kicker">{cityName} · {formatMonth(latestMonth)}</span>
              <h3>{selectedArea.name}</h3>

              <div className="map-selection-verdict">
                <i style={{ background: colorForPercentile(selectedMetric.percentile) }} />
                <div>
                  <strong>{relativeBand(selectedMetric.percentile, bandMode(metricKey))}</strong>
                  <small>
                    {selectedPercentile !== null
                      ? `Local position: ${selectedPercentile}th percentile among ${cityName} areas`
                      : "No city comparison available"}
                  </small>
                </div>
              </div>

              {metricKey === "contextual-overview" &&
              selectedSafetySignal?.contextualConcernPercentile !== null &&
              selectedSafetySignal?.contextualConcernPercentile !== undefined ? (
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
                    <small>{formatMetric(selectedBaseMetric.theftPerKm2, "/km²")}</small>
                  </div>
                  <div>
                    <span>Violence + property</span>
                    <strong>{relativeBand(selectedBaseMetric.violencePropertyDensityPercentile)}</strong>
                    <small>{formatMetric(selectedBaseMetric.violencePropertyPerKm2, "/km²")}</small>
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
                    <i style={{ left: `${Math.min(100, Math.max(0, selectedPercentile))}%` }} />
                  </div>
                  <div><span>Lower</span><span>Higher</span></div>
                </div>
              ) : null}

              <div className="map-selection-actions">
                <a className="map-selection-link" href={areaHref(selectedArea.id)}>
                  Details
                </a>
                <a className="map-selection-compare" href={`/compare?a=${encodeURIComponent(selectedArea.id)}`}>
                  Compare
                </a>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <details className="map-explain map-explain-compact explorer-explain">
        <summary>How to read this map</summary>
        <p>
          Colours compare neighbourhoods only inside {cityName}: green is lower relative to this city and red is higher.
          These percentiles are not comparable with another city. {" "}{currentMethod}
        </p>
      </details>
    </section>
  );
}
