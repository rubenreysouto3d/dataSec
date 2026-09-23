const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";

export type Neighbourhood = { id: string; name: string };
export type Point = { latitude: string; longitude: string };
export type AreaProfile = {
  id: string;
  sourceAreaId: string;
  name: string;
};

type AreaRow = {
  id: string;
  source_area_id: string;
  name: string;
};

type BoundaryRow = {
  period_start: string;
  geojson: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type MetricRow = {
  slug: string;
  label: string;
};

type ObservationRow = {
  metric_slug: string;
  period_start: string;
  period_end: string;
  value: number | string;
};

export type MonthlySummary = {
  month: string;
  total: number;
  categories: Array<{ category: string; label: string; count: number }>;
};

async function rest<T>(table: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "User-Agent": "dataSec/0.2 (+https://github.com/rubenreysouto3d/dataSec)",
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

export async function getNeighbourhoods(): Promise<Neighbourhood[]> {
  const rows = await rest<AreaRow[]>("areas", {
    select: "source_area_id,name,id",
    city_slug: "eq.london",
    active: "eq.true",
    order: "name.asc",
  });
  return rows.map((row) => ({ id: row.source_area_id, name: row.name }));
}

export async function getAreaProfile(sourceAreaId: string): Promise<AreaProfile | null> {
  const rows = await rest<AreaRow[]>("areas", {
    select: "id,source_area_id,name",
    source_area_id: `eq.${sourceAreaId}`,
    city_slug: "eq.london",
    limit: "1",
  });
  const row = rows[0];
  return row ? { id: row.id, sourceAreaId: row.source_area_id, name: row.name } : null;
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

export async function getMonthlySummaries(areaId: string, maxMonths = 6): Promise<MonthlySummary[]> {
  const [observations, metrics] = await Promise.all([
    rest<ObservationRow[]>("observations", {
      select: "metric_slug,period_start,period_end,value",
      area_id: `eq.${areaId}`,
      order: "period_start.desc",
      limit: String(Math.max(maxMonths * 30, 90)),
    }),
    rest<MetricRow[]>("metrics", {
      select: "slug,label",
      family: "eq.recorded_crime",
    }),
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
