import type { CityMapMetric, CitySafetySignal, CitySlug } from "@/lib/data";
import { buildVisitorPercentileMap } from "@/lib/map-filters";
import { metricForLayer, type MapLayerMetric } from "@/lib/map-view";
import { tr, type Locale } from "@/lib/i18n";

export type PlacePurpose = "resident" | "visitor";
export type PlaceEvidence = MapLayerMetric & {
  areaId: string;
  city: CitySlug;
  purpose: PlacePurpose;
  indicator: "personal-harm" | "violence-property-resident" | "theft-density";
  period: string | null;
  available: boolean;
  scope: "within-city";
};

/**
 * A CITY-WIDE indicator decision must be made before looking up an individual
 * area. Otherwise a missing Madrid harm value silently falls back to a
 * different measure and gets compared with incompatible neighbourhoods.
 * All consumer surfaces (map, API, iframe widget) share this contract.
 */
export function createPlaceEvidenceContext(
  city: CitySlug,
  metrics: readonly CityMapMetric[],
  safetySignals: readonly CitySafetySignal[],
) {
  const byId = new Map(metrics.map((item) => [item.areaId, item]));
  const signals = new Map(safetySignals.map((item) => [item.areaId, item]));
  const visitor = buildVisitorPercentileMap(metrics as CityMapMetric[]);
  const hasCityHarmSeries = city === "madrid" && safetySignals.some(
    (item) => item.months >= 3 &&
      item.residentPercentile !== null && item.personalHarmPer10k !== null,
  );

  function read(areaId: string, purpose: PlacePurpose): PlaceEvidence {
    const metric = byId.get(areaId);
    const signal = signals.get(areaId);
    const indicator = purpose === "visitor"
      ? "theft-density"
      : hasCityHarmSeries ? "personal-harm" : "violence-property-resident";
    const layer = purpose === "visitor"
      ? "visitor-context"
      : hasCityHarmSeries ? "residential-harm" : "contextual-overview";
    const observed = metricForLayer(metric, layer, signal, visitor.get(areaId) ?? null);
    const available = observed.value !== null &&
      observed.percentile !== null &&
      Number.isFinite(observed.value) && Number.isFinite(observed.percentile);
    // A city-wide harm series does not imply that every neighbourhood has
    // enough data. Never borrow the city's latest month for a missing area.
    const validHarm = signal && signal.months >= 3 &&
      signal.personalHarmPer10k !== null && signal.residentPercentile !== null;
    const period = !available ? null
      : indicator === "personal-harm"
        ? validHarm ? signal.monthStart + " – " + signal.monthEnd : null
        : metric?.month ?? null;
    return {
      ...observed,
      value: available ? observed.value : null,
      percentile: available ? observed.percentile : null,
      count: available ? observed.count : null,
      areaId, city, purpose, indicator, period, available,
      scope: "within-city",
    };
  }
  return { read, hasCityHarmSeries };
}

export function placeEvidenceLabel(
  city: CitySlug, purpose: PlacePurpose, hasCityHarmSeries: boolean, locale: Locale,
): string {
  if (purpose === "visitor") return tr(locale,
    "Recorded theft/robbery-related incidents per km²",
    "Hurtos y robos registrados por km²");
  if (city === "madrid" && hasCityHarmSeries) return tr(locale,
    "Selected personal-harm dispatches / 10,000 registered residents / month",
    "Incidencias seleccionadas de daño personal / 10.000 residentes / mes");
  if (city === "madrid") return tr(locale,
    "Selected violence/property dispatches / 10,000 registered residents",
    "Incidencias seleccionadas de violencia/propiedad / 10.000 residentes");
  return tr(locale,
    "Recorded violence + property / 10,000 Census residents",
    "Violencia y propiedad registradas / 10.000 habitantes del censo");
}

export function placeEvidenceExplanation(
  city: CitySlug, purpose: PlacePurpose, hasCityHarmSeries: boolean, locale: Locale,
): string {
  if (purpose === "visitor") return tr(locale,
    "Selected recorded theft and robbery categories per km². This is not a visitor risk rate: comparable visitor counts are unavailable.",
    "Categorías seleccionadas de hurtos y robos registrados por km². No es una tasa de riesgo para visitantes: no disponemos de afluencia comparable.");
  if (city === "madrid" && hasCityHarmSeries) return tr(locale,
    "Selected municipal police dispatches concerning personal harm per registered resident, averaged over available recent months. District perception surveys remain separate.",
    "Incidencias seleccionadas de Policía Municipal relacionadas con daños personales por residente empadronado, promediadas entre los meses recientes disponibles. Las encuestas distritales se mantienen aparte.");
  if (city === "madrid") return tr(locale,
    "The recent personal-harm series lacks enough city coverage. The same selected violence/property dispatch indicator is used for all measured neighbourhoods.",
    "La serie reciente de daño personal no tiene suficiente cobertura en la ciudad. Se aplica el mismo indicador de incidencias seleccionadas de violencia/propiedad a todos los barrios con datos.");
  return tr(locale,
    "Selected recorded violence and property offences relative to 2021 Census residents. These categories are not equivalent to Madrid's municipal police dispatches.",
    "Delitos seleccionados de violencia y propiedad registrados respecto a residentes del censo de 2021. Estas categorías no equivalen a las incidencias municipales de Madrid.");
}

export function placeEvidenceSource(city: CitySlug, locale: Locale) {
  return city === "madrid" ? {
    label: tr(locale, "Madrid Municipal Police dispatches", "Incidencias de Policía Municipal de Madrid"),
    url: "https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information",
    note: tr(locale, "Dispatch calls are not a certified count of crimes.", "Las incidencias policiales no equivalen a delitos acreditados."),
  } : {
    label: tr(locale, "Metropolitan Police / UK Police open data", "Metropolitan Police / datos abiertos británicos"),
    url: "https://data.police.uk/about/",
    note: tr(locale, "Recorded offences; geographic points are approximate.", "Delitos registrados; ubicaciones geográficas aproximadas."),
  };
}
