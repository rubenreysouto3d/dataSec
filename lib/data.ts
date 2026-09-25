const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";

export type CitySlug = "london" | "madrid";

export type Neighbourhood = {
  // Stable dataSec identity. Use this in routes and cross-feature references.
  id: string;
  sourceAreaId: string;
  stableId: string;
  name: string;
  citySlug: CitySlug;
  cityName: string;
  areaType: string;
};

export type Point = { latitude: string; longitude: string };

export type AreaProfile = {
  id: string;
  sourceAreaId: string;
  name: string;
  citySlug: CitySlug;
  cityName: string;
  areaType: string;
  sourceSlug: string;
  sourceAuthority: string;
  sourceUrl: string;
  sourceType: string;
  sourceGranularity: string | null;
};

type AreaRow = {
  id: string;
  source_area_id: string;
  name: string;
  city_slug: CitySlug;
  area_type: string;
  source_slug: string;
};

type CityRow = { slug: CitySlug; name: string };
type SourceRow = {
  slug: string;
  authority: string;
  source_url: string;
  source_type: string;
  granularity: string | null;
};

type BoundaryRow = {
  period_start: string;
  geojson: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type MetricRow = { slug: string; label: string };
type ObservationRow = {
  metric_slug: string;
  period_start: string;
  period_end: string;
  value: number | string;
};

type AreaContextRow = {
  area_id: string;
  city_slug: CitySlug;
  period_start: string;
  total_incidents: number | string;
  area_km2: number | string;
  incidents_per_km2: number | string;
  density_percentile: number | string;
};

export type AreaContext = {
  month: string;
  totalIncidents: number;
  areaKm2: number;
  incidentsPerKm2: number;
  densityPercentile: number;
};

export type CityAreaContext = AreaContext & {
  areaId: string;
};

export type CityBoundary = {
  areaId: string;
  rings: Point[][];
};

type CityMapMetricRow = {
  area_id: string;
  city_slug: CitySlug;
  period_start: string;
  total_incidents: number | string;
  area_km2: number | string;
  incidents_per_km2: number | string;
  density_percentile: number | string;
  crime_related_count: number | string | null;
  violence_property_count: number | string | null;
  theft_count: number | string | null;
  population: number | string | null;
  crime_related_per_km2: number | string | null;
  violence_property_per_km2: number | string | null;
  theft_per_km2: number | string | null;
  crime_related_per_10k: number | string | null;
  violence_property_per_10k: number | string | null;
  theft_per_10k: number | string | null;
  crime_related_density_percentile: number | string | null;
  violence_property_density_percentile: number | string | null;
  theft_density_percentile: number | string | null;
  crime_related_resident_percentile: number | string | null;
  violence_property_resident_percentile: number | string | null;
  theft_resident_percentile: number | string | null;
};

type CityActivityContextRow = {
  area_id: string;
  period_start: string;
  open_premises: number | string;
  open_hostelry: number | string;
};

export type CityActivityContext = {
  areaId: string;
  month: string;
  openPremises: number;
  openHostelry: number;
};

export type CitySafetySignal = {
  areaId: string;
  monthStart: string;
  monthEnd: string;
  months: number;
  personalHarmCount: number;
  averageMonthlyCount: number;
  personalHarmPer10k: number | null;
  residentPercentile: number | null;
  districtName: string | null;
  districtNightSafety: number | null;
  districtConcernPercentile: number | null;
  contextualConcernPercentile: number | null;
};

export type CityMapMetric = {
  areaId: string;
  citySlug: CitySlug;
  month: string;
  totalIncidents: number;
  areaKm2: number;
  incidentsPerKm2: number;
  densityPercentile: number;
  crimeRelatedCount: number;
  violencePropertyCount: number;
  theftCount: number;
  population: number | null;
  crimeRelatedPerKm2: number | null;
  violencePropertyPerKm2: number | null;
  theftPerKm2: number | null;
  crimeRelatedPer10k: number | null;
  violencePropertyPer10k: number | null;
  theftPer10k: number | null;
  crimeRelatedDensityPercentile: number | null;
  violencePropertyDensityPercentile: number | null;
  theftDensityPercentile: number | null;
  crimeRelatedResidentPercentile: number | null;
  violencePropertyResidentPercentile: number | null;
  theftResidentPercentile: number | null;
};

export type MonthlySummaryCategory = {
  category: string;
  label: string;
  count: number;
  group: "safety" | "other";
};

export type MonthlySummary = {
  month: string;
  total: number;
  categories: MonthlySummaryCategory[];
};

export type CitySnapshot = {
  month: string;
  areaCount: number;
  coveredAreaCount: number;
  medianIncidentsPerKm2: number;
};

export const cityNames: Record<CitySlug, string> = {
  london: "London",
  madrid: "Madrid",
};

export function areaTypeLabel(area: Pick<AreaProfile, "citySlug" | "areaType">): string {
  if (area.citySlug === "london") return "Metropolitan Police neighbourhood";
  if (area.areaType === "municipal_district") return "municipal district";
  return "municipal neighbourhood";
}

export function dataLabel(citySlug: CitySlug): string {
  return citySlug === "london" ? "Recorded incidents" : "Police dispatch incidents";
}

export function sourceExplanation(area: AreaProfile): string {
  if (area.citySlug === "london") {
    return "Police-recorded street-level incidents assigned to the official policing boundary published for the same month.";
  }
  return "Incidents handled by Madrid Municipal Police central dispatch and assigned to the official municipal area. This source is broader than crime and includes traffic, public-space, assistance and other police responses.";
}

async function rest<T>(
  table: string,
  params: Record<string, string>,
  options: { noStore?: boolean } = {},
): Promise<T> {
  const query = new URLSearchParams(params);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`;
  const retryable = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "User-Agent": "dataSec/0.3 (+https://github.com/rubenreysouto3d/dataSec)",
        "X-dataSec-attempt": String(attempt),
      },
      ...(options.noStore || attempt > 1
        ? { cache: "no-store" as const }
        : process.env.GITHUB_PAGES === "true"
          ? { cache: "force-cache" as const }
          : { next: { revalidate: 60 * 60 * 12 } }),
    });

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if (!retryable.has(response.status) || attempt === 3) {
      throw new Error(`Supabase Data API ${response.status}: ${table}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  throw new Error(`Supabase Data API retry exhausted: ${table}`);
}

let cityPromise: Promise<Map<CitySlug, string>> | null = null;
function getCityMap() {
  cityPromise ??= rest<CityRow[]>("cities", { select: "slug,name" }).then(
    (rows) => new Map(rows.map((row) => [row.slug, row.name])),
  );
  return cityPromise;
}

export async function getNeighbourhoods(citySlug?: CitySlug): Promise<Neighbourhood[]> {
  const params: Record<string, string> = {
    select: "id,source_area_id,name,city_slug,area_type,source_slug",
    active: "eq.true",
    order: "city_slug.asc,name.asc",
    limit: "2000",
  };
  if (citySlug) params.city_slug = `eq.${citySlug}`;

  const [rows, cities] = await Promise.all([rest<AreaRow[]>("areas", params), getCityMap()]);
  return rows
    .filter((row) => row.city_slug !== "madrid" || row.area_type === "municipal_neighbourhood")
    .map((row) => ({
    id: row.id,
    sourceAreaId: row.source_area_id,
    stableId: row.id,
    name: row.name,
    citySlug: row.city_slug,
    cityName: cities.get(row.city_slug) ?? cityNames[row.city_slug],
    areaType: row.area_type,
  }));
}

export async function getAreaProfile(areaId: string): Promise<AreaProfile | null> {
  const rows = await rest<AreaRow[]>("areas", {
    select: "id,source_area_id,name,city_slug,area_type,source_slug",
    id: `eq.${areaId}`,
    active: "eq.true",
    limit: "1",
  });
  const row = rows[0];
  if (!row) return null;

  const [cities, sources] = await Promise.all([
    rest<CityRow[]>("cities", { select: "slug,name", slug: `eq.${row.city_slug}`, limit: "1" }),
    rest<SourceRow[]>("sources", {
      select: "slug,authority,source_url,source_type,granularity",
      slug: `eq.${row.source_slug}`,
      limit: "1",
    }),
  ]);
  const source = sources[0];
  if (!source) throw new Error(`Missing source metadata for ${row.source_slug}`);

  return {
    id: row.id,
    sourceAreaId: row.source_area_id,
    name: row.name,
    citySlug: row.city_slug,
    cityName: cities[0]?.name ?? cityNames[row.city_slug],
    areaType: row.area_type,
    sourceSlug: row.source_slug,
    sourceAuthority: source.authority,
    sourceUrl: source.source_url,
    sourceType: source.source_type,
    sourceGranularity: source.granularity,
  };
}

export async function getBoundaryRings(areaId: string): Promise<{ month: string; rings: Point[][] } | null> {
  const rows = await rest<BoundaryRow[]>("latest_area_boundaries_geojson", {
    select: "period_start,geojson",
    area_id: `eq.${areaId}`,
    limit: "1",
  });
  const row = rows[0];
  if (!row) return null;

  const polygonCoordinates =
    row.geojson.type === "Polygon"
      ? [row.geojson.coordinates as number[][][]]
      : (row.geojson.coordinates as number[][][][]);

  const rings = polygonCoordinates
    .map((polygon) => polygon[0])
    .filter((ring): ring is number[][] => Array.isArray(ring) && ring.length >= 3)
    .map((ring) =>
      ring.map(([longitude, latitude]) => ({
        longitude: String(longitude),
        latitude: String(latitude),
      })),
    );

  return { month: row.period_start.slice(0, 7), rings };
}


export async function getCityBoundaries(areaIds: string[]): Promise<CityBoundary[]> {
  if (areaIds.length === 0) return [];
  const included = new Set(areaIds);
  const params: Record<string, string> = {
    select: "area_id,period_start,geojson",
    limit: "2000",
  };
  const firstId = areaIds[0];
  if (firstId.startsWith("es-madrid-neighbourhood:")) {
    params.area_id = "like.es-madrid-neighbourhood:*";
  } else if (firstId.startsWith("gb-london-metropolitan:")) {
    params.area_id = "like.gb-london-metropolitan:*";
  }

  const rows = await rest<Array<BoundaryRow & { area_id: string }>>(
    "latest_area_boundaries_map_geojson",
    params,
  );

  return rows
    .filter((row) => included.has(row.area_id))
    .map((row) => {
      const polygonCoordinates =
        row.geojson.type === "Polygon"
          ? [row.geojson.coordinates as number[][][]]
          : (row.geojson.coordinates as number[][][][]);

      const rings = polygonCoordinates
        .map((polygon) => polygon[0])
        .filter((ring): ring is number[][] => Array.isArray(ring) && ring.length >= 3)
        .map((ring) =>
          ring.map(([longitude, latitude]) => ({
            longitude: String(longitude),
            latitude: String(latitude),
          })),
        );

      return { areaId: row.area_id, rings };
    });
}

export async function getCityMapMetrics(
  citySlug: CitySlug,
  areaIds: string[],
): Promise<CityMapMetric[]> {
  const included = new Set(areaIds);
  const rows = await rest<CityMapMetricRow[]>("latest_area_map_metrics", {
    select: [
      "area_id",
      "city_slug",
      "period_start",
      "total_incidents",
      "area_km2",
      "incidents_per_km2",
      "density_percentile",
      "crime_related_count",
      "violence_property_count",
      "theft_count",
      "population",
      "crime_related_per_km2",
      "violence_property_per_km2",
      "theft_per_km2",
      "crime_related_per_10k",
      "violence_property_per_10k",
      "theft_per_10k",
      "crime_related_density_percentile",
      "violence_property_density_percentile",
      "theft_density_percentile",
      "crime_related_resident_percentile",
      "violence_property_resident_percentile",
      "theft_resident_percentile",
    ].join(","),
    city_slug: `eq.${citySlug}`,
    order: "area_id.asc",
    limit: "2000",
  });

  const numberOrNull = (value: number | string | null) =>
    value === null || value === undefined ? null : Number(value);

  let result: CityMapMetric[] = rows
    .filter((row) => included.has(row.area_id))
    .map((row) => ({
      areaId: row.area_id,
      citySlug: row.city_slug,
      month: row.period_start.slice(0, 7),
      totalIncidents: Number(row.total_incidents),
      areaKm2: Number(row.area_km2),
      incidentsPerKm2: Number(row.incidents_per_km2),
      densityPercentile: Number(row.density_percentile),
      crimeRelatedCount: Number(row.crime_related_count ?? 0),
      violencePropertyCount: Number(row.violence_property_count ?? 0),
      theftCount: Number(row.theft_count ?? 0),
      population: numberOrNull(row.population),
      crimeRelatedPerKm2: numberOrNull(row.crime_related_per_km2),
      violencePropertyPerKm2: numberOrNull(row.violence_property_per_km2),
      theftPerKm2: numberOrNull(row.theft_per_km2),
      crimeRelatedPer10k: numberOrNull(row.crime_related_per_10k),
      violencePropertyPer10k: numberOrNull(row.violence_property_per_10k),
      theftPer10k: numberOrNull(row.theft_per_10k),
      crimeRelatedDensityPercentile: numberOrNull(row.crime_related_density_percentile),
      violencePropertyDensityPercentile: numberOrNull(row.violence_property_density_percentile),
      theftDensityPercentile: numberOrNull(row.theft_density_percentile),
      crimeRelatedResidentPercentile: numberOrNull(row.crime_related_resident_percentile),
      violencePropertyResidentPercentile: numberOrNull(row.violence_property_resident_percentile),
      theftResidentPercentile: numberOrNull(row.theft_resident_percentile),
    }));

  // London's crime snapshots are current, while the best fully aligned official
  // resident denominator currently available is the 2021 Census. Preserve the
  // Census date in storage, then combine it here rather than pretending the
  // population measurement belongs to the crime month.
  if (citySlug === "london" && result.length) {
    type PopulationRow = {
      area_id: string;
      source_slug: string;
      period_start: string;
      population: number | string;
    };

    const populationRows = await rest<PopulationRow[]>("latest_area_population", {
      select: "area_id,source_slug,period_start,population",
      area_id: "like.gb-london-metropolitan:*",
      order: "area_id.asc",
      limit: "1000",
    });
    const populationByArea = new Map(
      populationRows
        .filter((row) => included.has(row.area_id))
        .map((row) => [row.area_id, Number(row.population)]),
    );

    result = result.map((metric) => {
      const population = populationByArea.get(metric.areaId) ?? null;
      const rate = (count: number) =>
        population && population > 0 ? (count * 10000) / population : null;
      return {
        ...metric,
        population,
        crimeRelatedPer10k: rate(metric.crimeRelatedCount),
        violencePropertyPer10k: rate(metric.violencePropertyCount),
        theftPer10k: rate(metric.theftCount),
      };
    });

    const percentileMap = (
      getter: (metric: CityMapMetric) => number | null,
    ) => {
      const ranked = result
        .map((metric) => ({ areaId: metric.areaId, value: getter(metric) }))
        .filter((item): item is { areaId: string; value: number } =>
          item.value !== null && Number.isFinite(item.value),
        )
        .sort((a, b) => a.value - b.value);
      const denominator = Math.max(ranked.length - 1, 1);
      const firstRank = new Map<number, number>();
      ranked.forEach((item, index) => {
        if (!firstRank.has(item.value)) firstRank.set(item.value, index / denominator);
      });
      return new Map(
        ranked.map((item) => [item.areaId, firstRank.get(item.value) ?? 0]),
      );
    };

    const crimeRanks = percentileMap((metric) => metric.crimeRelatedPer10k);
    const violenceRanks = percentileMap((metric) => metric.violencePropertyPer10k);
    const theftRanks = percentileMap((metric) => metric.theftPer10k);

    result = result.map((metric) => ({
      ...metric,
      crimeRelatedResidentPercentile: crimeRanks.get(metric.areaId) ?? null,
      violencePropertyResidentPercentile: violenceRanks.get(metric.areaId) ?? null,
      theftResidentPercentile: theftRanks.get(metric.areaId) ?? null,
    }));
  }

  return result;
}

const MADRID_DISTRICT_NIGHT_SAFETY_2025: Record<string, { name: string; score: number }> = {
  "01": { name: "Centro", score: 6.5 },
  "02": { name: "Arganzuela", score: 7.0 },
  "03": { name: "Retiro", score: 7.4 },
  "04": { name: "Salamanca", score: 7.5 },
  "05": { name: "Chamartín", score: 7.3 },
  "06": { name: "Tetuán", score: 6.1 },
  "07": { name: "Chamberí", score: 7.7 },
  "08": { name: "Fuencarral-El Pardo", score: 7.2 },
  "09": { name: "Moncloa-Aravaca", score: 7.3 },
  "10": { name: "Latina", score: 6.2 },
  "11": { name: "Carabanchel", score: 5.8 },
  "12": { name: "Usera", score: 5.2 },
  "13": { name: "Puente de Vallecas", score: 5.1 },
  "14": { name: "Moratalaz", score: 6.8 },
  "15": { name: "Ciudad Lineal", score: 6.2 },
  "16": { name: "Hortaleza", score: 7.0 },
  "17": { name: "Villaverde", score: 4.9 },
  "18": { name: "Villa de Vallecas", score: 6.1 },
  "19": { name: "Vicálvaro", score: 6.5 },
  "20": { name: "San Blas-Canillejas", score: 6.1 },
  "21": { name: "Barajas", score: 7.7 },
};

function madridDistrictCode(areaId: string) {
  const code = areaId.match(/:(\d{3})$/)?.[1];
  return code ? code.slice(0, 2) : null;
}

function percentileByValue(
  items: Array<{ key: string; value: number }>,
  direction: "ascending" | "descending" = "ascending",
) {
  const sorted = [...items].sort((a, b) =>
    direction === "ascending" ? a.value - b.value : b.value - a.value,
  );
  const denominator = Math.max(sorted.length - 1, 1);
  const firstRank = new Map<number, number>();
  sorted.forEach((item, index) => {
    if (!firstRank.has(item.value)) firstRank.set(item.value, index / denominator);
  });
  return new Map(items.map((item) => [item.key, firstRank.get(item.value) ?? 0]));
}

function isMadridPersonalHarmMetric(metric: MetricRow) {
  const text = `${metric.slug} ${metric.label}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const violentRobbery =
    /robo/.test(text) && /(violencia|intimidacion)/.test(text);
  const familyOrGenderViolence =
    /violencia/.test(text) && /(genero|familiar)/.test(text);

  return (
    /reyerta|agresion|amenaza|atentado/.test(text) ||
    /fallecid/.test(text) ||
    violentRobbery ||
    familyOrGenderViolence
  );
}

function monthOffset(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getCitySafetySignals(
  citySlug: CitySlug,
  areaIds: string[],
  mapMetrics: CityMapMetric[],
): Promise<CitySafetySignal[]> {
  if (citySlug !== "madrid" || !areaIds.length || !mapMetrics.length) return [];

  const latestMonth = mapMetrics.reduce(
    (latest, metric) => (!latest || metric.month > latest ? metric.month : latest),
    "",
  );
  if (!latestMonth) return [];

  const firstMonth = monthOffset(latestMonth, -5);
  const metrics = await getMetrics();
  const personalHarmSlugs = metrics
    .filter((metric) => metric.slug.startsWith("madrid-dispatch-"))
    .filter(isMadridPersonalHarmMetric)
    .map((metric) => metric.slug);

  if (!personalHarmSlugs.length) return [];

  type HarmObservationRow = {
    area_id: string;
    metric_slug: string;
    period_start: string;
    value: number | string;
  };

  const rows: HarmObservationRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const page = await rest<HarmObservationRow[]>("observations", {
      select: "area_id,metric_slug,period_start,value",
      source_slug: "eq.madrid-police-dispatch-incidents",
      metric_slug: `in.(${personalHarmSlugs.join(",")})`,
      period_start: `gte.${firstMonth}-01`,
      order: "period_start.asc,area_id.asc,metric_slug.asc",
      limit: String(pageSize),
      offset: String(offset),
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  const included = new Set(areaIds);
  const populationByArea = new Map(mapMetrics.map((metric) => [metric.areaId, metric.population]));
  const totals = new Map<string, number>();
  const months = new Set<string>();

  for (const row of rows) {
    if (!included.has(row.area_id)) continue;
    const month = row.period_start.slice(0, 7);
    if (month < firstMonth || month > latestMonth) continue;
    months.add(month);
    totals.set(row.area_id, (totals.get(row.area_id) ?? 0) + Number(row.value));
  }

  const monthCount = Math.max(months.size, 1);
  const base = areaIds.map((areaId) => {
    const personalHarmCount = totals.get(areaId) ?? 0;
    const averageMonthlyCount = personalHarmCount / monthCount;
    const population = populationByArea.get(areaId);
    const personalHarmPer10k =
      population && population > 0 ? (averageMonthlyCount * 10000) / population : null;
    return {
      areaId,
      monthStart: firstMonth,
      monthEnd: latestMonth,
      months: months.size,
      personalHarmCount,
      averageMonthlyCount,
      personalHarmPer10k,
      residentPercentile: null as number | null,
    };
  });

  const ranked = base
    .filter((item) => item.personalHarmPer10k !== null && Number.isFinite(item.personalHarmPer10k))
    .sort((a, b) => (a.personalHarmPer10k ?? 0) - (b.personalHarmPer10k ?? 0));
  const denominator = Math.max(ranked.length - 1, 1);
  const firstRank = new Map<number, number>();
  ranked.forEach((item, index) => {
    const value = item.personalHarmPer10k ?? 0;
    if (!firstRank.has(value)) firstRank.set(value, index / denominator);
  });

  const withResident = base.map((item) => ({
    ...item,
    residentPercentile:
      item.personalHarmPer10k === null
        ? null
        : firstRank.get(item.personalHarmPer10k) ?? null,
  }));

  const districtConcern = percentileByValue(
    Object.entries(MADRID_DISTRICT_NIGHT_SAFETY_2025).map(([key, value]) => ({
      key,
      value: value.score,
    })),
    "descending",
  );

  const withContext = withResident.map((item) => {
    const districtCode = madridDistrictCode(item.areaId);
    const district = districtCode ? MADRID_DISTRICT_NIGHT_SAFETY_2025[districtCode] : undefined;
    const districtConcernPercentile =
      districtCode && district ? districtConcern.get(districtCode) ?? null : null;
    const contextualRaw =
      item.residentPercentile !== null && districtConcernPercentile !== null
        ? (item.residentPercentile + districtConcernPercentile) / 2
        : null;
    return {
      ...item,
      districtName: district?.name ?? null,
      districtNightSafety: district?.score ?? null,
      districtConcernPercentile,
      contextualRaw,
    };
  });

  const overviewRanks = percentileByValue(
    withContext
      .filter((item) => item.contextualRaw !== null)
      .map((item) => ({ key: item.areaId, value: item.contextualRaw ?? 0 })),
  );

  return withContext.map(({ contextualRaw: _contextualRaw, ...item }) => ({
    ...item,
    contextualConcernPercentile:
      item.residentPercentile === null || item.districtConcernPercentile === null
        ? null
        : overviewRanks.get(item.areaId) ?? null,
  }));
}

export async function getCityActivityContexts(areaIds: string[]): Promise<CityActivityContext[]> {
  const included = new Set(areaIds);
  const rows = await rest<CityActivityContextRow[]>("latest_area_activity_context", {
    select: "area_id,period_start,open_premises,open_hostelry",
    order: "area_id.asc",
    limit: "2000",
  });
  return rows
    .filter((row) => included.has(row.area_id))
    .map((row) => ({
      areaId: row.area_id,
      month: row.period_start.slice(0, 7),
      openPremises: Number(row.open_premises),
      openHostelry: Number(row.open_hostelry),
    }));
}

let areaContextPromise: Promise<Array<AreaContext & { areaId: string; citySlug: CitySlug }>> | null = null;

async function getAllAreaContexts(): Promise<Array<AreaContext & { areaId: string; citySlug: CitySlug }>> {
  areaContextPromise ??= rest<AreaContextRow[]>("latest_area_context", {
    select: "area_id,city_slug,period_start,total_incidents,area_km2,incidents_per_km2,density_percentile",
    order: "city_slug.asc,area_id.asc",
    limit: "2000",
  }).then((rows) =>
    rows.map((row) => ({
      areaId: row.area_id,
      citySlug: row.city_slug,
      month: row.period_start.slice(0, 7),
      totalIncidents: Number(row.total_incidents),
      areaKm2: Number(row.area_km2),
      incidentsPerKm2: Number(row.incidents_per_km2),
      densityPercentile: Number(row.density_percentile),
    })),
  );
  return areaContextPromise;
}

export async function getAreaContext(areaId: string): Promise<AreaContext | null> {
  const rows = await getAllAreaContexts();
  return rows.find((row) => row.areaId === areaId) ?? null;
}

export async function getCityAreaContexts(
  citySlug: CitySlug,
  areaIds: string[],
): Promise<CityAreaContext[]> {
  const included = new Set(areaIds);
  const cityRows = (await getAllAreaContexts()).filter(
    (row) => row.citySlug === citySlug && included.has(row.areaId),
  );
  if (cityRows.length === 0) return [];

  const latestMonth = cityRows.reduce(
    (latest, row) => (row.month > latest ? row.month : latest),
    cityRows[0].month,
  );

  return cityRows
    .filter((row) => row.month === latestMonth)
    .map(({ areaId, month, totalIncidents, areaKm2, incidentsPerKm2, densityPercentile }) => ({
      areaId,
      month,
      totalIncidents,
      areaKm2,
      incidentsPerKm2,
      densityPercentile,
    }));
}

export async function getCitySnapshot(
  citySlug: CitySlug,
  areaIds: string[],
): Promise<CitySnapshot | null> {
  const included = new Set(areaIds);
  const contexts = (await getAllAreaContexts()).filter(
    (row) => row.citySlug === citySlug && included.has(row.areaId),
  );
  if (contexts.length === 0) return null;

  const month = contexts.reduce(
    (latest, row) => (row.month > latest ? row.month : latest),
    contexts[0].month,
  );
  const current = contexts.filter((row) => row.month === month);
  const densities = current
    .map((row) => row.incidentsPerKm2)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (densities.length === 0) return null;

  const middle = Math.floor(densities.length / 2);
  const medianIncidentsPerKm2 =
    densities.length % 2 === 0
      ? (densities[middle - 1] + densities[middle]) / 2
      : densities[middle];

  return {
    month,
    areaCount: areaIds.length,
    coveredAreaCount: current.length,
    medianIncidentsPerKm2,
  };
}

let metricsPromise: Promise<MetricRow[]> | null = null;
function getMetrics() {
  metricsPromise ??= rest<MetricRow[]>("metrics", { select: "slug,label", limit: "500" });
  return metricsPromise;
}

function normaliseCategoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function canonicalCategory(
  metricSlug: string,
  rawLabel: string,
): { label: string; group: "safety" | "other" } {
  const text = normaliseCategoryText(`${metricSlug} ${rawLabel}`);

  // Non-crime responses stay visible, but never compete with the safety signal.
  if (/samur|summa|ambulanc|asistencia sanitaria|auxilio sanitario|emergencia sanitaria/.test(text)) {
    return { label: "Emergency assistance", group: "other" };
  }
  if (/trafico|traffic|seguridad vial|accidente.*veh|vehiculo.*averiado/.test(text)) {
    return { label: "Traffic & road safety", group: "other" };
  }
  if (/conflicto.*privad|mediacion|resolucion.*conflict/.test(text)) {
    return { label: "Private dispute mediation", group: "other" };
  }
  if (/administrativ|documentacion|identificacion|objetos perdidos|animal/.test(text)) {
    return { label: "Other police activity", group: "other" };
  }

  // Canonical safety vocabulary shared across source languages.
  if (/hurto|theft|shoplift|pickpocket/.test(text)) {
    return { label: "Theft", group: "safety" };
  }
  if (/robbery|robo.*violencia|robo.*intimidacion/.test(text)) {
    return { label: "Robbery", group: "safety" };
  }
  if (/burglary|robo.*fuerza|robo.*domicilio|robo.*establecimiento/.test(text)) {
    return { label: "Burglary", group: "safety" };
  }
  if (/vehicle crime|sustraccion.*veh|robo.*veh|theft.*vehicle/.test(text)) {
    return { label: "Vehicle crime", group: "safety" };
  }
  if (/violence|agresion|assault|reyerta|amenaza|violencia.*genero|violencia.*familiar/.test(text)) {
    return { label: "Violence & assault", group: "safety" };
  }
  if (/sexual|violacion|abuso sexual/.test(text)) {
    return { label: "Sexual offences", group: "safety" };
  }
  if (/drug|droga|estupefaciente/.test(text)) {
    return { label: "Drugs", group: "safety" };
  }
  if (/weapon|arma/.test(text)) {
    return { label: "Weapons", group: "safety" };
  }
  if (/criminal damage|damage|danos|vandal/.test(text)) {
    return { label: "Criminal damage", group: "safety" };
  }
  if (/public order|orden publico|desorden|molestias|ruido/.test(text)) {
    return { label: "Public disorder", group: "safety" };
  }
  if (/anti-social|antisocial/.test(text)) {
    return { label: "Anti-social behaviour", group: "safety" };
  }

  // London source labels are already user-facing English. Unknown Madrid dispatch
  // labels are kept out of the safety ranking until explicitly mapped.
  if (!metricSlug.startsWith("madrid-dispatch-")) {
    return { label: rawLabel || humanCategory(metricSlug), group: "safety" };
  }

  return { label: "Other police activity", group: "other" };
}

export async function getMonthlySummaries(areaId: string, maxMonths = 6): Promise<MonthlySummary[]> {
  const [observations, metrics] = await Promise.all([
    rest<ObservationRow[]>("observations", {
      select: "metric_slug,period_start,period_end,value",
      area_id: `eq.${areaId}`,
      order: "period_start.desc,value.desc",
      limit: String(Math.max(maxMonths * 80, 200)),
    }),
    getMetrics(),
  ]);

  const labels = new Map(metrics.map((metric) => [metric.slug, metric.label]));
  const grouped = new Map<string, Map<string, MonthlySummaryCategory>>();

  for (const row of observations) {
    const month = row.period_start.slice(0, 7);
    if (!grouped.has(month) && grouped.size >= maxMonths) continue;

    const rawLabel = labels.get(row.metric_slug) ?? humanCategory(row.metric_slug);
    const canonical = canonicalCategory(row.metric_slug, rawLabel);
    const key = `${canonical.group}:${canonical.label}`;
    const categories = grouped.get(month) ?? new Map<string, MonthlySummaryCategory>();
    const existing = categories.get(key);

    categories.set(key, {
      category: key,
      label: canonical.label,
      group: canonical.group,
      count: (existing?.count ?? 0) + Number(row.value),
    });
    grouped.set(month, categories);
  }

  return [...grouped.entries()].map(([month, categoryMap]) => {
    const categories = [...categoryMap.values()].sort((a, b) => b.count - a.count);
    return {
      month,
      total: categories.reduce((sum, item) => sum + item.count, 0),
      categories,
    };
  });
}

export function humanCategory(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
}
