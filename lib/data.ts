const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";

export type CitySlug = "london" | "madrid";

export type Neighbourhood = {
  id: string;
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

export type MonthlySummary = {
  month: string;
  total: number;
  categories: Array<{ category: string; label: string; count: number }>;
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

async function rest<T>(table: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "User-Agent": "dataSec/0.3 (+https://github.com/rubenreysouto3d/dataSec)",
    },
    ...(process.env.GITHUB_PAGES === "true"
      ? { cache: "force-cache" as const }
      : { next: { revalidate: 60 * 60 * 12 } }),
  });

  if (!response.ok) {
    throw new Error(`Supabase Data API ${response.status}: ${table}`);
  }
  return response.json() as Promise<T>;
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
  return rows.map((row) => ({
    id: row.source_area_id,
    stableId: row.id,
    name: row.name,
    citySlug: row.city_slug,
    cityName: cities.get(row.city_slug) ?? cityNames[row.city_slug],
    areaType: row.area_type,
  }));
}

export async function getAreaProfile(sourceAreaId: string): Promise<AreaProfile | null> {
  const rows = await rest<AreaRow[]>("areas", {
    select: "id,source_area_id,name,city_slug,area_type,source_slug",
    source_area_id: `eq.${sourceAreaId}`,
    active: "eq.true",
    limit: "2",
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

let areaContextPromise: Promise<Array<AreaContext & { areaId: string; citySlug: CitySlug }>> | null = null;

async function getAllAreaContexts(): Promise<Array<AreaContext & { areaId: string; citySlug: CitySlug }>> {
  areaContextPromise ??= rest<AreaContextRow[]>("area_month_context", {
    select: "area_id,city_slug,period_start,total_incidents,area_km2,incidents_per_km2,density_percentile",
    order: "period_start.desc",
    limit: "5000",
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

let metricsPromise: Promise<MetricRow[]> | null = null;
function getMetrics() {
  metricsPromise ??= rest<MetricRow[]>("metrics", { select: "slug,label", limit: "500" });
  return metricsPromise;
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
  const grouped = new Map<string, Array<{ category: string; label: string; count: number }>>();

  for (const row of observations) {
    const month = row.period_start.slice(0, 7);
    if (!grouped.has(month) && grouped.size >= maxMonths) continue;
    const categories = grouped.get(month) ?? [];
    categories.push({
      category: row.metric_slug,
      label: labels.get(row.metric_slug) ?? humanCategory(row.metric_slug),
      count: Number(row.value),
    });
    grouped.set(month, categories);
  }

  return [...grouped.entries()].map(([month, categories]) => ({
    month,
    total: categories.reduce((sum, item) => sum + item.count, 0),
    categories: categories.sort((a, b) => b.count - a.count),
  }));
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
