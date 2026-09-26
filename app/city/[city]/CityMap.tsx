"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { areaHref } from "@/lib/area-route";
import { locateAreaByCoordinates, resolvePlaceToArea } from "@/lib/public-data-client";
import { areaDisplayName, cityNames } from "@/lib/data";
import {
  buildVisitorPercentileMap,
  cityFilterMethods,
  CITY_FILTER_METHODS,
  MAP_ADVANCED_FILTERS,
  MAP_AUDIENCES,
  MAP_COLOR_BANDS,
  type MapAudienceKey,
} from "@/lib/map-filters";
import {
  bandMode,
  bandNumber,
  layerFor,
  metricForLayer,
  metricKeyForLayer,
  normalizationForLayer,
  relativeBand,
  type MapLayerKey as LayerKey,
  type MapMetricKey as MetricKey,
  type MapNormalizationKey as NormalizationKey,
} from "@/lib/map-view";
import { localeHref, localeTag, tr, type Locale } from "@/lib/i18n";
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
  initialAudience?: MapAudienceKey;
  locale?: Locale;
};

type AudienceKey = MapAudienceKey | "advanced";

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

const metricCopyEs: typeof metricCopy = {
  "contextual-overview": {
    label: "Contexto para residentes",
    short: "Contexto residente",
    note: "Contexto residencial con las mejores señales oficiales disponibles para esta ciudad. El percentil es local y no es una puntuación entre ciudades.",
  },
  "visitor-context": {
    label: "Contexto para visitantes",
    short: "Contexto visitante",
    note: "Contexto de estancia corta ponderado hacia hurtos y robos, con un componente menor de violencia/propiedad. Usa concentración por zona en lugar de población empadronada.",
  },
  "residential-harm": {
    label: "Daño personal · historial reciente",
    short: "Daño personal · historial reciente",
    note: "Señal de Madrid con los meses recientes disponibles de violencia, agresiones, robos violentos, violencia familiar/de género y categorías relacionadas, normalizada por residentes.",
  },
  "violence-property": {
    label: "Violencia y propiedad",
    short: "Violencia + propiedad",
    note: "Categorías seleccionadas relacionadas con violencia y delitos contra la propiedad.",
  },
  theft: {
    label: "Hurtos y robos",
    short: "Hurtos + robos",
    note: "Categorías de hurtos, robos y sustracciones de vehículos/propiedad.",
  },
  "crime-related": {
    label: "Toda actividad delictiva",
    short: "Toda actividad delictiva",
    note: "Categorías delictivas mapeadas desde la fuente oficial; se excluye actividad no delictiva cuando la fuente la contiene.",
  },
  activity: {
    label: "Toda actividad de la fuente",
    short: "Toda la actividad",
    note: "Todo lo incluido en la fuente oficial de la ciudad, incluida actividad no delictiva cuando exista.",
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

function formatMetric(value: number | null, unit: string, locale: Locale) {
  if (value === null || !Number.isFinite(value)) return tr(locale, "No value", "Sin valor");
  return value.toLocaleString(localeTag(locale), { maximumFractionDigits: 1 }) + unit;
}

function formatMonth(month: string | undefined, locale: Locale) {
  if (!month) return tr(locale, "Latest snapshot", "Última captura");
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return new Intl.DateTimeFormat(localeTag(locale), { month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
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

export default function CityMap({
  citySlug,
  areas,
  boundaries,
  metrics,
  activityContexts,
  safetySignals,
  initialAudience = "resident",
  locale = "en",
}: Props) {
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
  const [audience, setAudience] = useState<AudienceKey>(initialAudience);
  const [layer, setLayer] = useState<LayerKey>(
    initialAudience === "visitor" ? "visitor-context" : "contextual-overview",
  );
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaSearch, setAreaSearch] = useState("");
  const [finderStatus, setFinderStatus] = useState<"idle" | "searching" | "locating" | "error">("idle");
  const [finderMessage, setFinderMessage] = useState("");

  const cityName = cityNames[citySlug];
  const cityMethods = cityFilterMethods(citySlug, locale);
  const activeMetricCopy = locale === "es" ? metricCopyEs : metricCopy;
  const residentMethod =
    citySlug === "madrid" && hasContextualOverview
      ? tr(
          locale,
          "50% recent personal-harm percentile + 50% 2025 district night-safety perception percentile",
          "50% percentil de daño personal reciente + 50% percentil de percepción de seguridad nocturna del distrito en 2025",
        )
      : hasResidentLayer
        ? cityMethods.residentFallbackMethod
        : tr(
            locale,
            "violence + property density (population denominator unavailable)",
            "densidad de violencia + propiedad (denominador de población no disponible)",
          );
  const visitorMethod = tr(
    locale,
    "70% theft + robbery concentration + 30% violence + property concentration",
    "70% concentración de hurtos + robos + 30% concentración de violencia + propiedad",
  );

  const safetyWindowMonths = safetySignals.reduce((max, signal) => Math.max(max, signal.months), 0);
  const safetyWindowLabel = safetyWindowMonths
    ? locale === "es"
      ? `${safetyWindowMonths} mes${safetyWindowMonths === 1 ? "" : "es"}`
      : `${safetyWindowMonths} month${safetyWindowMonths === 1 ? "" : "s"}`
    : tr(locale, "recent history", "historial reciente");
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
          name: areaDisplayName(area),
          href: localeHref(locale, areaHref(area.id)),
          percentile: selected.percentile,
          value: selected.value,
          count: selected.count,
          unit: selected.unit,
          population: metricById.get(area.id)?.population ?? null,
          band: relativeBand(selected.percentile, bandMode(metricKey), locale),
          displayMode: bandMode(metricKey),
          bandNumber: bandNumber(selected.percentile),
        },
        geometry: boundary.rings.length === 1
          ? { type: "Polygon", coordinates: [coordinates[0]] }
          : { type: "MultiPolygon", coordinates: coordinates.map((ring) => [ring]) },
      }];
    });

    return { type: "FeatureCollection", features };
  }, [areaById, boundaries, layer, locale, metricById, safetySignalById, visitorPercentileById]);

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
        name: areaDisplayName(area),
        path: fallbackPath(boundary, bounds),
        fill: colorForPercentile(selected.percentile),
        bandNumber: bandNumber(selected.percentile),
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
    setAreaSearch(areaDisplayName(area));

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

    const displayExact = areas.find(
      (area) => areaDisplayName(area).toLocaleLowerCase() === needle,
    );
    if (displayExact) {
      setFinderStatus("idle");
      focusArea(displayExact.id);
      return;
    }

    const rawExact = areas.filter(
      (area) => area.name.toLocaleLowerCase() === needle,
    );
    if (rawExact.length === 1) {
      setFinderStatus("idle");
      focusArea(rawExact[0].id);
      return;
    }
    if (rawExact.length > 1) {
      setFinderStatus("error");
      setFinderMessage(
        `${tr(locale, "More than one", "Hay más de un")} “${text}” ${tr(locale, "in", "en")} ${cityName}. ${tr(locale, "Choose the borough from the suggestions.", "Elige el distrito/borough en las sugerencias.")}`,
      );
      return;
    }

    const partialMatches = areas.filter((area) =>
      `${area.name} ${area.parentName ?? ""}`.toLocaleLowerCase().includes(needle),
    );
    if (partialMatches.length === 1) {
      setFinderStatus("idle");
      focusArea(partialMatches[0].id);
      return;
    }

    setFinderStatus("searching");
    try {
      const place = await resolvePlaceToArea(text);
      if (!place) {
        setFinderStatus("error");
        setFinderMessage(tr(locale, "No covered neighbourhood matched that place or address.", "Ninguna zona cubierta coincide con ese lugar o dirección."));
        return;
      }

      if (place.citySlug === citySlug && areaById.has(place.id)) {
        focusArea(place.id);
        setFinderStatus("idle");
        setFinderMessage(`${tr(locale, "Matched", "Coincidencia")}: ${place.matchedPlace}`);
        return;
      }

      window.location.href = areaHref(place.id);
    } catch {
      setFinderStatus("error");
      setFinderMessage(tr(locale, "Place lookup is temporarily unavailable.", "La búsqueda de lugares no está disponible temporalmente."));
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setFinderStatus("error");
      setFinderMessage(tr(locale, "Location is not available in this browser.", "La ubicación no está disponible en este navegador."));
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
            setFinderMessage(tr(locale, "Your location is outside current dataSec coverage.", "Tu ubicación está fuera de la cobertura actual de dataSec."));
            return;
          }

          if (place.citySlug === citySlug && areaById.has(place.id)) {
            focusArea(place.id);
            setFinderStatus("idle");
            setFinderMessage(`${tr(locale, "You are in", "Estás en")} ${place.name}.`);
            return;
          }

          window.location.href = areaHref(place.id);
        } catch {
          setFinderStatus("error");
          setFinderMessage(tr(locale, "We could not match your location to an official boundary.", "No pudimos asociar tu ubicación a un límite oficial."));
        }
      },
      () => {
        setFinderStatus("error");
        setFinderMessage(tr(locale, "Location permission was not available.", "No se pudo obtener permiso de ubicación."));
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
            setMapError(tr(locale, "Interactive basemap unavailable — showing the data map instead.", "Mapa base interactivo no disponible; se muestra el mapa de datos."));
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
            id: "datasec-areas-band-label",
            type: "symbol",
            source: "datasec-areas",
            minzoom: citySlug === "madrid" ? 10 : 10.5,
            layout: {
              "text-field": ["to-string", ["get", "bandNumber"]],
              "text-size": 11,
              "text-allow-overlap": false,
              "text-ignore-placement": false,
            },
            paint: {
              "text-color": "#151513",
              "text-halo-color": "rgba(255,255,255,.92)",
              "text-halo-width": 1.5,
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
                  ? `${value.toLocaleString(localeTag(locale), { maximumFractionDigits: 1 })}${props.unit ?? ""}`
                  : String(props.band ?? tr(locale, "No value", "Sin valor"));

            const context = document.createElement("small");
            context.textContent = Number.isFinite(percentile)
              ? displayMode === "resident"
                ? locale === "es"
                  ? `La preocupación residencial es mayor que en aproximadamente el ${Math.round(percentile * 100)}% de las zonas de ${cityName}`
                  : `Residential concern is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
                : displayMode === "visitor"
                  ? locale === "es"
                    ? `La exposición para visitantes es mayor que en aproximadamente el ${Math.round(percentile * 100)}% de las zonas de ${cityName}`
                    : `Visitor exposure is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
                  : locale === "es"
                    ? `El nivel registrado es mayor que en aproximadamente el ${Math.round(percentile * 100)}% de las zonas de ${cityName}`
                    : `Recorded level is higher than about ${Math.round(percentile * 100)}% of ${cityName} areas`
              : tr(locale, "No city comparison available", "Sin comparación con la ciudad");

            const hint = document.createElement("small");
            hint.textContent = tr(locale, "Click for details", "Haz clic para ver detalles");

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
            if (area) setAreaSearch(areaDisplayName(area));
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
        if (!cancelled) setMapError(tr(locale, "The interactive basemap could not be loaded.", "No se pudo cargar el mapa base interactivo."));
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
  }, [bounds, citySlug, locale]);

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
          <span className="explorer-toolbar-label">{tr(locale, "View for", "Vista para")}</span>
          <div className="map-audience-buttons map-audience-buttons-compact" role="group" aria-label={tr(locale, "Map audience", "Tipo de usuario del mapa")}>
            {MAP_AUDIENCES.map((item) => (
              <button
                type="button"
                key={item.key}
                className={audience === item.key ? "is-active" : ""}
                aria-pressed={audience === item.key}
                onClick={() => chooseAudience(item.key)}
              >
                <strong>
                  {item.key === "resident"
                    ? tr(locale, "Resident", "Residente")
                    : tr(locale, "Visitor", "Visitante")}
                </strong>
                <small>
                  {item.key === "resident"
                    ? tr(locale, "Living here", "Vivir aquí")
                    : tr(locale, "Short stay", "Estancia corta")}
                </small>
              </button>
            ))}
          </div>
        </div>

        <details className="explorer-filter-menu">
          <summary>
            <span>{tr(locale, "Filter", "Filtro")}</span>
            <strong>{activeMetricCopy[metricKey].short}</strong>
          </summary>
          <div className="explorer-filter-body">
            <div className="explorer-filter-section">
              <span>{tr(locale, "Metric · same choices in every city", "Métrica · mismas opciones en cada ciudad")}</span>
              <div className="map-choice-row" role="group" aria-label={tr(locale, "Incident type", "Tipo de incidencia")}>
                {metricOptions.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={metricKey === item.key ? "is-active" : ""}
                    aria-pressed={metricKey === item.key}
                    onClick={() => chooseMetric(item.key)}
                  >
                    {item.key === "violence-property"
                      ? tr(locale, "Violence + property", "Violencia + propiedad")
                      : item.key === "theft"
                        ? tr(locale, "Theft + robbery", "Hurtos + robos")
                        : item.key === "crime-related"
                          ? tr(locale, "All crime-related", "Toda actividad delictiva")
                          : tr(locale, "All source activity", "Toda actividad de la fuente")}
                  </button>
                ))}
              </div>
            </div>

            {metricKey !== "contextual-overview" &&
            metricKey !== "visitor-context" &&
            metricKey !== "residential-harm" ? (
              <div className="explorer-filter-section">
                <span>{tr(locale, "Compare areas by", "Comparar zonas por")}</span>
                <div className="map-choice-row map-normalization-row" role="group" aria-label={tr(locale, "Comparison basis", "Base de comparación")}>
                  <button
                    type="button"
                    className={normalization === "density" ? "is-active" : ""}
                    aria-pressed={normalization === "density"}
                    onClick={() => chooseNormalization("density")}
                  >
                    <strong>{tr(locale, "Area", "Superficie")}</strong>
                    <small>per km²</small>
                  </button>
                  <button
                    type="button"
                    className={normalization === "resident" ? "is-active" : ""}
                    aria-pressed={normalization === "resident"}
                    disabled={!hasResidentLayer || metricKey === "activity"}
                    onClick={() => chooseNormalization("resident")}
                  >
                    <strong>{tr(locale, "Residents", "Residentes")}</strong>
                    <small>{tr(locale, "per 10,000", "por 10.000")}</small>
                  </button>
                </div>
              </div>
            ) : null}

            <small className="explorer-filter-method">
              {tr(locale, "Local to", "Local de")} {cityName} · {currentMethod}
            </small>
          </div>
        </details>

        <div className="map-color-key explorer-color-key" aria-label={tr(locale, `Relative five-level scale within ${cityName}`, `Escala relativa de cinco niveles en ${cityName}`)}>
          <span>1 · {tr(locale, "Lower in", "Más bajo en")} {cityName}</span>
          <i />
          <span>5 · {tr(locale, "Higher in", "Más alto en")} {cityName}</span>
        </div>
      </div>

      <div className="explorer-active-definition">
        <strong>
          {audience === "resident"
            ? `${cityName} ${tr(locale, "Resident", "Residente")}`
            : audience === "visitor"
              ? `${cityName} ${tr(locale, "Visitor", "Visitante")}`
              : `${cityName} ${tr(locale, "filter", "filtro")}`}
        </strong>
        <span>{currentMethod}</span>
        <small>
          {tr(
            locale,
            "Local comparison only · not comparable as one score across cities",
            "Comparación solo local · no es una puntuación comparable entre ciudades",
          )}
        </small>
      </div>

      <div className={`map-stage ${selectedArea ? "has-selection" : ""}`}>
        <div className="interactive-map-wrap">
          {!mapReady && bounds ? (
            <svg
              className="datasec-fallback-map"
              viewBox="0 0 1000 700"
              role="img"
              aria-label={tr(locale, `${cityName} neighbourhood data map`, `Mapa de datos por zonas de ${cityName}`)}
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
                    <title>{shape.name}{shape.bandNumber ? ` · ${tr(locale, "level", "nivel")} ${shape.bandNumber}/5` : ""}</title>
                  </path>
                ))}
              </g>
            </svg>
          ) : null}

          <div ref={containerRef} className={`interactive-city-map ${mapReady ? "is-ready" : ""}`} />

          <div className="map-area-finder map-area-finder-simple">
            <label className="sr-only" htmlFor="area-map-search">
              {tr(locale, "Find a neighbourhood", "Buscar una zona")}
            </label>
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
                placeholder={tr(locale, "Neighbourhood, address or hotel…", "Barrio, dirección u hotel…")}
              />
              <button
                type="button"
                onClick={findArea}
                disabled={!bounds || finderStatus === "searching" || finderStatus === "locating"}
              >
                {finderStatus === "searching"
                  ? tr(locale, "Matching…", "Buscando…")
                  : tr(locale, "Find", "Buscar")}
              </button>
              <button
                type="button"
                onClick={locateMe}
                disabled={finderStatus === "searching" || finderStatus === "locating"}
              >
                {finderStatus === "locating"
                  ? tr(locale, "Locating…", "Localizando…")
                  : tr(locale, "Use my location", "Usar mi ubicación")}
              </button>
            </div>
            {finderMessage ? (
              <small className={finderStatus === "error" ? "map-finder-error" : "map-finder-note"}>
                {finderMessage}
              </small>
            ) : null}
            <datalist id="area-map-options">
              {areas.map((area) => <option value={areaDisplayName(area)} key={area.id} />)}
            </datalist>
          </div>

          <button className="map-city-reset" type="button" onClick={fitToCity}>
            {tr(locale, "Whole city", "Toda la ciudad")}
          </button>

          {!mapReady && !mapError ? (
            <div className="map-fallback-status">
              {tr(locale, "Loading interactive map…", "Cargando mapa interactivo…")}
            </div>
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
                aria-label={tr(locale, "Close selected area", "Cerrar zona seleccionada")}
              >
                ×
              </button>

              <span className="map-selection-kicker">
                {cityName}{selectedArea.parentName ? ` · ${selectedArea.parentName}` : ""} · {formatMonth(latestMonth, locale)}
              </span>
              <h3>{selectedArea.name}</h3>

              <div className="map-selection-verdict">
                <i style={{ background: colorForPercentile(selectedMetric.percentile) }} />
                <div>
                  <strong>{relativeBand(selectedMetric.percentile, bandMode(metricKey))}</strong>
                  <small>
                    {selectedPercentile !== null
                      ? locale === "es"
                        ? `Nivel ${bandNumber(selectedMetric.percentile)}/5 · posición local: percentil ${selectedPercentile} entre las zonas de ${cityName}`
                        : `Level ${bandNumber(selectedMetric.percentile)}/5 · local position: ${selectedPercentile}th percentile among ${cityName} areas`
                      : tr(locale, "No city comparison available", "Sin comparación con la ciudad")}
                  </small>
                </div>
              </div>

              {metricKey === "contextual-overview" &&
              selectedSafetySignal?.contextualConcernPercentile !== null &&
              selectedSafetySignal?.contextualConcernPercentile !== undefined ? (
                <div className="map-overview-components">
                  <div>
                    <span>{tr(locale, "Recorded personal harm", "Daño personal registrado")}</span>
                    <strong>{relativeBand(selectedSafetySignal.residentPercentile, "resident", locale)}</strong>
                    <small>
                      {formatMetric(
                        selectedSafetySignal.personalHarmPer10k,
                        tr(locale, "/10k residents / month", "/10.000 residentes / mes"),
                        locale,
                      )} · {selectedSafetySignal.months} {tr(locale, "months", "meses")}
                    </small>
                  </div>
                  <div>
                    <span>{tr(locale, "Resident perception at night", "Percepción residente por la noche")}</span>
                    <strong>
                      {selectedSafetySignal.districtNightSafety !== null
                        ? `${selectedSafetySignal.districtNightSafety.toFixed(1)}/10`
                        : tr(locale, "Unavailable", "No disponible")}
                    </strong>
                    <small>{selectedSafetySignal.districtName ?? tr(locale, "District unavailable", "Distrito no disponible")} · {tr(locale, "2025 survey", "encuesta 2025")}</small>
                  </div>
                </div>
              ) : metricKey === "visitor-context" && selectedBaseMetric ? (
                <div className="map-overview-components">
                  <div>
                    <span>{tr(locale, "Theft + robbery", "Hurtos + robos")}</span>
                    <strong>{relativeBand(selectedBaseMetric.theftDensityPercentile, "recorded", locale)}</strong>
                    <small>{formatMetric(selectedBaseMetric.theftPerKm2, "/km²", locale)}</small>
                  </div>
                  <div>
                    <span>{tr(locale, "Violence + property", "Violencia + propiedad")}</span>
                    <strong>{relativeBand(selectedBaseMetric.violencePropertyDensityPercentile, "recorded", locale)}</strong>
                    <small>{formatMetric(selectedBaseMetric.violencePropertyPerKm2, "/km²", locale)}</small>
                  </div>
                </div>
              ) : (
                <div className="map-value-compare">
                  <div>
                    <span>{tr(locale, "This area", "Esta zona")}</span>
                    <strong>{formatMetric(selectedMetric.value, selectedMetric.unit, locale)}</strong>
                  </div>
                  <div>
                    <span>{tr(locale, "City median", "Mediana de la ciudad")}</span>
                    <strong>{formatMetric(cityMedian, selectedMetric.unit, locale)}</strong>
                  </div>
                </div>
              )}

              {selectedPercentile !== null ? (
                <div className="map-relative-scale" aria-label={tr(locale, `Relative position: ${selectedPercentile}%`, `Posición relativa: ${selectedPercentile}%`)}>
                  <div className="map-relative-track">
                    <i style={{ left: `${Math.min(100, Math.max(0, selectedPercentile))}%` }} />
                  </div>
                  <div>
                    <span>{tr(locale, "Lower", "Más bajo")}</span>
                    <span>{tr(locale, "Higher", "Más alto")}</span>
                  </div>
                </div>
              ) : null}

              <div className="map-selection-actions">
                <a className="map-selection-link" href={localeHref(locale, areaHref(selectedArea.id))}>
                  {tr(locale, "Details", "Detalles")}
                </a>
                <a
                  className="map-selection-compare"
                  href={localeHref(
                    locale,
                    `/compare?a=${encodeURIComponent(selectedArea.id)}&layer=${encodeURIComponent(layer)}`,
                  )}
                >
                  {tr(locale, "Compare", "Comparar")}
                </a>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <details className="map-explain map-explain-compact explorer-explain">
        <summary>{tr(locale, "How to read this map", "Cómo leer este mapa")}</summary>
        <p>
          {tr(
            locale,
            `Colours compare neighbourhoods only inside ${cityName}: green is lower relative to this city and red is higher. The same scale is also encoded as levels 1–5, so colour is not the only signal. These percentiles are not comparable with another city.`,
            `Los colores comparan zonas solo dentro de ${cityName}: el verde indica una señal relativa menor y el rojo una mayor. La misma escala también se codifica como niveles 1–5, por lo que el color no es la única señal. Estos percentiles no son comparables con otra ciudad.`,
          )}{" "}{currentMethod}
        </p>
      </details>
      <p className="density-caution map-safety-disclaimer">
        {tr(
          locale,
          "Context only — not a prediction or guarantee of personal safety. Recorded official-source data can be affected by reporting, footfall, nightlife and source methodology.",
          "Solo contexto: no es una predicción ni una garantía de seguridad personal. Los datos oficiales registrados pueden verse afectados por la denuncia, la afluencia, la vida nocturna y la metodología de la fuente.",
        )}
      </p>
    </section>
  );
}
