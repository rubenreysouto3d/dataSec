import type { CityMapMetric, CitySafetySignal } from "@/lib/data";
import type { MapAdvancedFilterKey } from "@/lib/map-filters";
import { tr, type Locale } from "@/lib/i18n";

export type MapMetricKey =
  | "contextual-overview"
  | "visitor-context"
  | "residential-harm"
  | MapAdvancedFilterKey;

export type MapNormalizationKey = "density" | "resident";

export type MapLayerKey =
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

export type MapLayerMetric = {
  percentile: number | null;
  value: number | null;
  count: number | null;
  unit: string;
};

export const MAP_LAYER_KEYS: readonly MapLayerKey[] = [
  "contextual-overview",
  "visitor-context",
  "residential-harm",
  "violence-property",
  "theft",
  "crime-related",
  "activity",
  "violence-property-resident",
  "theft-resident",
  "crime-related-resident",
];

export function isMapLayerKey(value: string | null | undefined): value is MapLayerKey {
  return Boolean(value && MAP_LAYER_KEYS.includes(value as MapLayerKey));
}

export function metricKeyForLayer(layer: MapLayerKey): MapMetricKey {
  return layer.replace("-resident", "") as MapMetricKey;
}

export function normalizationForLayer(layer: MapLayerKey): MapNormalizationKey {
  return layer.endsWith("-resident") ? "resident" : "density";
}

export function layerFor(
  metric: MapMetricKey,
  normalization: MapNormalizationKey,
): MapLayerKey {
  if (metric === "contextual-overview") return "contextual-overview";
  if (metric === "visitor-context") return "visitor-context";
  if (metric === "residential-harm") return "residential-harm";
  if (normalization === "resident" && metric !== "activity") {
    return `${metric}-resident` as MapLayerKey;
  }
  return metric;
}

export function metricForLayer(
  metric: CityMapMetric | undefined,
  layer: MapLayerKey,
  safetySignal?: CitySafetySignal,
  visitorPercentile?: number | null,
): MapLayerMetric {
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
      value:
        safetySignal?.contextualConcernPercentile !== null &&
        safetySignal?.contextualConcernPercentile !== undefined
          ? null
          : hasResidentValue
            ? metric?.violencePropertyPer10k ?? null
            : metric?.violencePropertyPerKm2 ?? null,
      count: safetySignal?.personalHarmCount ?? metric?.violencePropertyCount ?? null,
      unit:
        safetySignal?.contextualConcernPercentile !== null &&
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

  if (!metric) {
    return { percentile: null, value: null, count: null, unit: "" };
  }

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

export function bandNumber(percentile: number | null) {
  if (percentile === null || !Number.isFinite(percentile)) return null;
  return Math.min(5, Math.max(1, Math.floor(percentile * 5) + 1));
}

export function relativeBand(
  percentile: number | null,
  mode: "resident" | "visitor" | "recorded" = "recorded",
  locale: Locale = "en",
) {
  if (percentile === null || !Number.isFinite(percentile)) {
    return tr(locale, "No city comparison", "Sin comparación con la ciudad");
  }

  if (mode === "resident") {
    if (percentile < 0.2) return tr(locale, "Lowest residential concern", "Menor preocupación residencial");
    if (percentile < 0.4) return tr(locale, "Lower residential concern", "Preocupación residencial baja");
    if (percentile < 0.6) return tr(locale, "Around the city middle", "En torno a la media de la ciudad");
    if (percentile < 0.8) return tr(locale, "Higher residential concern", "Preocupación residencial alta");
    return tr(locale, "Highest residential concern", "Mayor preocupación residencial");
  }

  if (mode === "visitor") {
    if (percentile < 0.2) return tr(locale, "Lowest visitor exposure", "Menor exposición para visitantes");
    if (percentile < 0.4) return tr(locale, "Lower visitor exposure", "Exposición baja para visitantes");
    if (percentile < 0.6) return tr(locale, "Around the city middle", "En torno a la media de la ciudad");
    if (percentile < 0.8) return tr(locale, "Higher visitor exposure", "Exposición alta para visitantes");
    return tr(locale, "Highest visitor exposure", "Mayor exposición para visitantes");
  }

  if (percentile < 0.2) return tr(locale, "Lowest 20% of areas", "20% de zonas con señal más baja");
  if (percentile < 0.4) return tr(locale, "Lower than most areas", "Más baja que en la mayoría de zonas");
  if (percentile < 0.6) return tr(locale, "Around the city middle", "En torno a la media de la ciudad");
  if (percentile < 0.8) return tr(locale, "Higher than most areas", "Más alta que en la mayoría de zonas");
  return tr(locale, "Highest 20% of areas", "20% de zonas con señal más alta");
}

export function bandMode(
  metricKey: MapMetricKey,
): "resident" | "visitor" | "recorded" {
  if (metricKey === "contextual-overview") return "resident";
  if (metricKey === "visitor-context") return "visitor";
  return "recorded";
}

export function mapLayerLabel(layer: MapLayerKey, locale: Locale = "en") {
  switch (layer) {
    case "contextual-overview":
      return tr(locale, "Resident context", "Contexto para residentes");
    case "visitor-context":
      return tr(locale, "Visitor context", "Contexto para visitantes");
    case "residential-harm":
      return tr(locale, "Personal harm · recent history", "Daño personal · historial reciente");
    case "violence-property-resident":
      return tr(locale, "Violence + property · residents", "Violencia + propiedad · residentes");
    case "theft-resident":
      return tr(locale, "Theft + robbery · residents", "Hurtos + robos · residentes");
    case "crime-related-resident":
      return tr(locale, "All crime-related · residents", "Toda actividad delictiva · residentes");
    case "violence-property":
      return tr(locale, "Violence + property · area", "Violencia + propiedad · superficie");
    case "theft":
      return tr(locale, "Theft + robbery · area", "Hurtos + robos · superficie");
    case "crime-related":
      return tr(locale, "All crime-related · area", "Toda actividad delictiva · superficie");
    case "activity":
      return tr(locale, "All source activity · area", "Toda actividad de la fuente · superficie");
  }
}
