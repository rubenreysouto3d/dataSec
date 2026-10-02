import type { CityMapMetric, CitySlug } from "@/lib/data";
import type { Locale } from "@/lib/i18n";

export const MAP_AUDIENCES = [
  {
    key: "resident",
    label: "Resident",
    detail: "Living here",
  },
  {
    key: "visitor",
    label: "Visitor",
    detail: "Short stay",
  },
] as const;

export const MAP_ADVANCED_FILTERS = [
  {
    key: "violence-property",
    label: "Violence + property",
  },
  {
    key: "theft",
    label: "Theft + robbery",
  },
  {
    key: "crime-related",
    label: "All crime-related",
  },
  {
    key: "activity",
    label: "All source activity",
  },
] as const;

export const MAP_COLOR_BANDS = [
  { max: 0.2, label: "Lowest band", color: "#3f9b63" },
  { max: 0.4, label: "Lower", color: "#8ab85b" },
  { max: 0.6, label: "Middle", color: "#dfc64c" },
  { max: 0.8, label: "Higher", color: "#e28a43" },
  { max: 1, label: "Highest band", color: "#c84c3f" },
] as const;

export type MapAudienceKey = (typeof MAP_AUDIENCES)[number]["key"];
export type MapAdvancedFilterKey = (typeof MAP_ADVANCED_FILTERS)[number]["key"];


export const CITY_FILTER_METHODS: Record<CitySlug, {
  residentPopulationLabel: string;
  residentUnitLabel: string;
  residentFallbackMethod: string;
  violencePropertyMethod: string;
  theftMethod: string;
  crimeRelatedMethod: string;
  activityMethod: string;
}> = {
  london: {
    residentPopulationLabel: "2021 Census residents",
    residentUnitLabel: "per 10,000 residents · 2021 Census",
    residentFallbackMethod: "violence + property per 10,000 residents · 2021 Census denominator",
    violencePropertyMethod: "Met Police recorded-crime categories mapped to violence + property",
    theftMethod: "Met Police theft, robbery and vehicle-crime categories",
    crimeRelatedMethod: "Met Police crime-related categories; anti-social behaviour excluded",
    activityMethod: "All Metropolitan Police source activity in the stored snapshot",
  },
  madrid: {
    residentPopulationLabel: "Registered residents",
    residentUnitLabel: "per 10,000 registered residents",
    residentFallbackMethod: "violence + property per 10,000 registered residents",
    violencePropertyMethod: "Madrid dispatch categories mapped to violence + property",
    theftMethod: "Madrid theft, robbery and vehicle/property-theft dispatch categories",
    crimeRelatedMethod: "Madrid crime-related dispatch categories; non-crime responses excluded",
    activityMethod: "All Madrid Municipal Police dispatch activity in the source",
  },
};


export const CITY_FILTER_METHODS_ES: typeof CITY_FILTER_METHODS = {
  london: {
    residentPopulationLabel: "residentes del Censo de 2021",
    residentUnitLabel: "por 10.000 residentes · Censo de 2021",
    residentFallbackMethod: "violencia + propiedad por 10.000 residentes · denominador del Censo de 2021",
    violencePropertyMethod: "categorías de delitos registrados por la Met Police mapeadas a violencia + propiedad",
    theftMethod: "categorías de hurtos, robos y delitos relacionados con vehículos de la Met Police",
    crimeRelatedMethod: "categorías delictivas de la Met Police; conducta antisocial excluida",
    activityMethod: "toda la actividad de la fuente de la Metropolitan Police en la captura almacenada",
  },
  madrid: {
    residentPopulationLabel: "residentes empadronados",
    residentUnitLabel: "por 10.000 residentes empadronados",
    residentFallbackMethod: "violencia + propiedad por 10.000 residentes empadronados",
    violencePropertyMethod: "categorías de incidencias de Madrid mapeadas a violencia + propiedad",
    theftMethod: "categorías de hurtos, robos y sustracciones de vehículos/propiedad de Madrid",
    crimeRelatedMethod: "categorías delictivas de Madrid; respuestas no delictivas excluidas",
    activityMethod: "toda la actividad de la fuente de Policía Municipal de Madrid",
  },
};

export function cityFilterMethods(citySlug: CitySlug, locale: Locale) {
  return locale === "es" ? CITY_FILTER_METHODS_ES[citySlug] : CITY_FILTER_METHODS[citySlug];
}

/**
 * Tourist-oriented observable indicator, not an estimate of the chance that a
 * visitor will experience a crime. Keep the underlying category mix inspectable.
 * Avoid opaque, unvalidated blends of unlike category percentiles.
 */
export function visitorExposureScore(metric: CityMapMetric | undefined) {
  if (!metric || metric.theftPerKm2 === null) return null;
  const value = metric.theftDensityPercentile;
  return value !== null && Number.isFinite(value) ? value : null;
}

export function buildVisitorPercentileMap(metrics: CityMapMetric[]) {
  return new Map(
    metrics.map((metric) => [metric.areaId, visitorExposureScore(metric)]),
  );
}
