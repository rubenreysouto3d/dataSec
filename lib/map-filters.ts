import type { CityMapMetric, CitySlug } from "@/lib/data";

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
  { max: 0.2, label: "Lowest 20%", color: "#3f9b63" },
  { max: 0.4, label: "Lower", color: "#8ab85b" },
  { max: 0.6, label: "Middle", color: "#dfc64c" },
  { max: 0.8, label: "Higher", color: "#e28a43" },
  { max: 1, label: "Highest 20%", color: "#c84c3f" },
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


export function visitorExposureScore(metric: CityMapMetric | undefined) {
  if (!metric) return null;
  const theft = metric.theftDensityPercentile;
  const violence = metric.violencePropertyDensityPercentile;
  if (theft === null && violence === null) return null;
  if (theft === null) return violence;
  if (violence === null) return theft;
  return theft * 0.7 + violence * 0.3;
}

export function buildVisitorPercentileMap(metrics: CityMapMetric[]) {
  const scored = metrics
    .map((metric) => ({ areaId: metric.areaId, score: visitorExposureScore(metric) }))
    .filter((item): item is { areaId: string; score: number } =>
      item.score !== null && Number.isFinite(item.score),
    )
    .sort((a, b) => a.score - b.score);

  const denominator = Math.max(scored.length - 1, 1);
  const firstRankByScore = new Map<number, number>();
  scored.forEach((item, index) => {
    if (!firstRankByScore.has(item.score)) {
      firstRankByScore.set(item.score, index / denominator);
    }
  });

  return new Map(
    scored.map((item) => [item.areaId, firstRankByScore.get(item.score) ?? 0]),
  );
}
