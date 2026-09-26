import { canonicalCategory, humanCategory, type CanonicalCategoryGroup } from "./category-taxonomy";

const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";

type AreaRow = {
  id: string;
  source_area_id: string;
  name: string;
  city_slug: "london" | "madrid";
};
type ContextRow = {
  period_start: string;
  total_incidents: number | string;
  area_km2: number | string;
  incidents_per_km2: number | string;
  density_percentile: number | string;
};
type ObservationRow = { metric_slug: string; period_start: string; value: number | string };
type MetricRow = { slug: string; label: string };
type CityRow = { slug: "london" | "madrid"; name: string };

export type CompareProfile = {
  id: string;
  sourceAreaId: string;
  name: string;
  citySlug: "london" | "madrid";
  cityName: string;
  month: string;
  total: number;
  areaKm2: number;
  incidentsPerKm2: number;
  densityPercentile: number;
  categories: Array<{ slug: string; label: string; count: number; group: CanonicalCategoryGroup }>;
};

async function rest<T>(table: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`;
  const retryable = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "X-dataSec-attempt": String(attempt),
      },
      cache: attempt > 1 ? "no-store" : "default",
    });

    if (response.ok) return response.json() as Promise<T>;

    if (!retryable.has(response.status) || attempt === 3) {
      throw new Error(`Supabase Data API ${response.status}: ${table}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }

  throw new Error(`Supabase Data API retry exhausted: ${table}`);
}

let metricsPromise: Promise<MetricRow[]> | null = null;
function getMetrics() {
  metricsPromise ??= rest<MetricRow[]>("metrics", {
    select: "slug,label",
    limit: "500",
  });
  return metricsPromise;
}

let citiesPromise: Promise<Map<string, string>> | null = null;
function getCities() {
  citiesPromise ??= rest<CityRow[]>("cities", { select: "slug,name" }).then(
    (rows) => new Map(rows.map((row) => [row.slug, row.name])),
  );
  return citiesPromise;
}

export async function getCompareProfile(areaId: string): Promise<CompareProfile | null> {
  const areas = await rest<AreaRow[]>("areas", {
    select: "id,source_area_id,name,city_slug",
    id: `eq.${areaId}`,
    active: "eq.true",
    limit: "1",
  });
  const area = areas[0];
  if (!area) return null;

  const [contexts, metrics, cities] = await Promise.all([
    rest<ContextRow[]>("area_month_context", {
      select: "period_start,total_incidents,area_km2,incidents_per_km2,density_percentile",
      area_id: `eq.${area.id}`,
      order: "period_start.desc",
      limit: "1",
    }),
    getMetrics(),
    getCities(),
  ]);
  const context = contexts[0];
  if (!context) return null;

  const observations = await rest<ObservationRow[]>("observations", {
    select: "metric_slug,period_start,value",
    area_id: `eq.${area.id}`,
    period_start: `eq.${context.period_start}`,
    order: "value.desc",
    limit: "200",
  });

  const labels = new Map(metrics.map((metric) => [metric.slug, metric.label]));
  const categoryMap = new Map<
    string,
    { slug: string; label: string; count: number; group: CanonicalCategoryGroup }
  >();

  for (const row of observations) {
    const rawLabel = labels.get(row.metric_slug) ?? humanCategory(row.metric_slug);
    const canonical = canonicalCategory(row.metric_slug, rawLabel);
    const slug = `${canonical.group}:${canonical.label}`;
    const existing = categoryMap.get(slug);
    categoryMap.set(slug, {
      slug,
      label: canonical.label,
      group: canonical.group,
      count: (existing?.count ?? 0) + Number(row.value),
    });
  }

  return {
    id: area.id,
    sourceAreaId: area.source_area_id,
    name: area.name,
    citySlug: area.city_slug,
    cityName: cities.get(area.city_slug) ?? area.city_slug,
    month: context.period_start.slice(0, 7),
    total: Number(context.total_incidents),
    areaKm2: Number(context.area_km2),
    incidentsPerKm2: Number(context.incidents_per_km2),
    densityPercentile: Number(context.density_percentile),
    categories: [...categoryMap.values()].sort((a, b) => b.count - a.count),
  };
}

type PointAreaRow = {
  area_id: string;
  source_area_id: string;
  name: string;
  city_slug: "london" | "madrid";
};

export async function locateAreaByCoordinates(
  latitude: number,
  longitude: number,
): Promise<{ id: string; name: string; citySlug: "london" | "madrid" } | null> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_area_at_point`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_lon: longitude,
      p_lat: latitude,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase RPC ${response.status}: find_area_at_point`);
  }

  const rows = (await response.json()) as PointAreaRow[];
  const row = rows[0];
  return row
    ? { id: row.area_id, name: row.name, citySlug: row.city_slug }
    : null;
}


type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

const GEOCODER_URL = "https://nominatim.openstreetmap.org/search";

export async function resolvePlaceToArea(
  query: string,
): Promise<{
  id: string;
  name: string;
  citySlug: "london" | "madrid";
  matchedPlace: string;
} | null> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    countrycodes: "gb,es",
    addressdetails: "0",
  });

  const response = await fetch(`${GEOCODER_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Geocoder HTTP ${response.status}`);
  }

  const results = (await response.json()) as NominatimResult[];
  for (const result of results) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const area = await locateAreaByCoordinates(latitude, longitude);
    if (area) {
      return {
        ...area,
        matchedPlace: result.display_name,
      };
    }
  }

  return null;
}
