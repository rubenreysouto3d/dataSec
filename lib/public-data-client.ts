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
  sourceAreaId: string;
  name: string;
  citySlug: "london" | "madrid";
  cityName: string;
  month: string;
  total: number;
  areaKm2: number;
  incidentsPerKm2: number;
  densityPercentile: number;
  categories: Array<{ slug: string; label: string; count: number }>;
};

async function rest<T>(table: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!response.ok) throw new Error(`Supabase Data API ${response.status}: ${table}`);
  return response.json() as Promise<T>;
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

export async function getCompareProfile(sourceAreaId: string): Promise<CompareProfile | null> {
  const areas = await rest<AreaRow[]>("areas", {
    select: "id,source_area_id,name,city_slug",
    source_area_id: `eq.${sourceAreaId}`,
    active: "eq.true",
    limit: "2",
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
  return {
    sourceAreaId: area.source_area_id,
    name: area.name,
    citySlug: area.city_slug,
    cityName: cities.get(area.city_slug) ?? area.city_slug,
    month: context.period_start.slice(0, 7),
    total: Number(context.total_incidents),
    areaKm2: Number(context.area_km2),
    incidentsPerKm2: Number(context.incidents_per_km2),
    densityPercentile: Number(context.density_percentile),
    categories: observations
      .map((row) => ({
        slug: row.metric_slug,
        label: labels.get(row.metric_slug) ?? row.metric_slug,
        count: Number(row.value),
      }))
      .sort((a, b) => b.count - a.count),
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
    ? { id: row.source_area_id, name: row.name, citySlug: row.city_slug }
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
