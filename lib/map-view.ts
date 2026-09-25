import type { CityMapMetric, CitySafetySignal } from "@/lib/data";
import type { MapAdvancedFilterKey } from "@/lib/map-filters";

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

export function bandMode(
  metricKey: MapMetricKey,
): "resident" | "visitor" | "recorded" {
  if (metricKey === "contextual-overview") return "resident";
  if (metricKey === "visitor-context") return "visitor";
  return "recorded";
}

export function mapLayerLabel(layer: MapLayerKey) {
  switch (layer) {
    case "contextual-overview":
      return "Resident context";
    case "visitor-context":
      return "Visitor context";
    case "residential-harm":
      return "Personal harm · recent history";
    case "violence-property-resident":
      return "Violence + property · residents";
    case "theft-resident":
      return "Theft + robbery · residents";
    case "crime-related-resident":
      return "All crime-related · residents";
    case "violence-property":
      return "Violence + property · area";
    case "theft":
      return "Theft + robbery · area";
    case "crime-related":
      return "All crime-related · area";
    case "activity":
      return "All source activity · area";
  }
}
