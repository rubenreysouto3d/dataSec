const API = "https://data.police.uk/api";
const FORCE = "metropolitan";

export type Neighbourhood = { id: string; name: string };
export type Point = { latitude: string; longitude: string };
export type NeighbourhoodDetail = {
  id: string;
  name: string;
  population: string;
  description: string | null;
  centre: { latitude: string; longitude: string };
};
export type Crime = {
  category: string;
  month: string;
  persistent_id: string;
  location: {
    latitude: string;
    longitude: string;
    street: { id: number; name: string };
  };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "User-Agent": "dataSec/0.1 (+https://github.com/rubenreysouto3d/dataSec)",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error(`Police API ${response.status}: ${path}`);
  return response.json() as Promise<T>;
}

export async function getNeighbourhoods(): Promise<Neighbourhood[]> {
  return api<Neighbourhood[]>(`/${FORCE}/neighbourhoods`);
}

export async function getNeighbourhood(id: string): Promise<NeighbourhoodDetail> {
  return api<NeighbourhoodDetail>(`/${FORCE}/${encodeURIComponent(id)}`);
}

export async function getBoundary(id: string): Promise<Point[]> {
  return api<Point[]>(`/${FORCE}/${encodeURIComponent(id)}/boundary`);
}

export async function getLatestMonths(count = 6): Promise<string[]> {
  const dates = await api<Array<{ date: string }>>("/crimes-street-dates");
  return dates.slice(0, count).map((item) => item.date);
}

function simplifyBoundary(points: Point[], maxPoints = 180): Point[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, index) => index % step === 0);
}

export async function getCrimesForBoundary(boundary: Point[], date: string): Promise<Crime[]> {
  const simplified = simplifyBoundary(boundary);
  const poly = simplified.map((p) => `${p.latitude},${p.longitude}`).join(":");
  const body = new URLSearchParams({ poly, date });

  const response = await fetch(`${API}/crimes-street/all-crime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "dataSec/0.1 (+https://github.com/rubenreysouto3d/dataSec)",
    },
    body,
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) throw new Error(`Police crime API ${response.status} for ${date}`);
  const crimes = (await response.json()) as Crime[];
  if (crimes.length === 10_000) {
    throw new Error(
      `Police crime API reached its 10,000-result cap for ${date}; refusing to present a truncated count as exact`,
    );
  }
  return crimes;
}

export function humanCategory(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function summarizeCrimes(crimes: Crime[]) {
  const counts = new Map<string, number>();
  for (const crime of crimes) counts.set(crime.category, (counts.get(crime.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([category, count]) => ({ category, label: humanCategory(category), count }))
    .sort((a, b) => b.count - a.count);
}

export function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
}
