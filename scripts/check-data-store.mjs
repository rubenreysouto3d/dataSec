// Trigger this check on infrastructure changes so a successful deploy cannot cache a transient data-store failure.
import { readFileSync } from "node:fs";

const clientSource = readFileSync(
  new URL("../lib/public-data-client.ts", import.meta.url),
  "utf8",
);

function readPublicConstant(name) {
  const match = clientSource.match(
    new RegExp(`const ${name} = ["']([^"']+)["'];`),
  );
  if (!match) throw new Error(`Could not read public config constant: ${name}`);
  return match[1];
}

const SUPABASE_URL = readPublicConstant("SUPABASE_URL");
const SUPABASE_PUBLISHABLE_KEY = readPublicConstant("SUPABASE_PUBLISHABLE_KEY");

const CITY_RULES = {
  london: {
    areaType: null,
    stablePrefix: "gb-london-metropolitan:",
    maxAgeMonths: 4,
    minimumCoverage: 0.9,
  },
  madrid: {
    areaType: "municipal_neighbourhood",
    stablePrefix: "es-madrid-neighbourhood:",
    maxAgeMonths: 4,
    minimumCoverage: 0.9,
  },
};

async function request(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Data API ${response.status} for ${path}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function monthAge(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid source month: ${month}`);
  }
  const [year, value] = month.split("-").map(Number);
  const now = new Date();
  return (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - value);
}

function asFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid numeric ${label}: ${value}`);
  return number;
}

async function checkCity(city, rule) {
  const areaParams = new URLSearchParams({
    select: "id,source_area_id,name",
    city_slug: `eq.${city}`,
    active: "eq.true",
    order: "id.asc",
    limit: "2000",
  });
  if (rule.areaType) areaParams.set("area_type", `eq.${rule.areaType}`);

  const [areas, contexts] = await Promise.all([
    request(`areas?${areaParams.toString()}`),
    request(
      `latest_area_context?select=area_id,city_slug,period_start,total_incidents,area_km2,incidents_per_km2,density_percentile&city_slug=eq.${city}&order=period_start.desc&limit=2000`,
    ),
  ]);

  if (!Array.isArray(areas) || areas.length === 0) {
    throw new Error(`No active ${city} areas are publicly readable`);
  }
  if (!Array.isArray(contexts) || contexts.length === 0) {
    throw new Error(`No latest context rows are publicly readable for ${city}`);
  }

  for (const area of areas) {
    if (typeof area.id !== "string" || !area.id.startsWith(rule.stablePrefix)) {
      throw new Error(`Unexpected stable area id for ${city}: ${area.id}`);
    }
  }

  const latestMonth = contexts
    .map((row) => String(row.period_start ?? "").slice(0, 7))
    .sort()
    .at(-1);
  if (!latestMonth) throw new Error(`Could not determine latest stored month for ${city}`);

  const activeIds = new Set(areas.map((area) => area.id));
  const current = contexts.filter(
    (row) =>
      String(row.period_start ?? "").startsWith(latestMonth) &&
      activeIds.has(row.area_id),
  );

  for (const row of current) {
    const total = asFinite(row.total_incidents, `${city} total_incidents`);
    const areaKm2 = asFinite(row.area_km2, `${city} area_km2`);
    const density = asFinite(row.incidents_per_km2, `${city} incidents_per_km2`);
    const percentile = asFinite(row.density_percentile, `${city} density_percentile`);

    if (total < 0 || areaKm2 <= 0 || density < 0) {
      throw new Error(`Implausible latest context row for ${city}: ${JSON.stringify(row)}`);
    }
    if (percentile < 0 || percentile > 1) {
      throw new Error(`Out-of-range density percentile for ${city}: ${percentile}`);
    }
  }

  const coverage = current.length / areas.length;
  if (coverage < rule.minimumCoverage) {
    throw new Error(
      `${city} latest-month coverage is only ${(coverage * 100).toFixed(1)}% (${current.length}/${areas.length}) for ${latestMonth}`,
    );
  }

  const ageMonths = monthAge(latestMonth);
  if (ageMonths < 0) {
    throw new Error(`${city} latest stored month is in the future: ${latestMonth}`);
  }
  if (ageMonths > rule.maxAgeMonths) {
    throw new Error(
      `${city} stored data is stale: latest month ${latestMonth} is ${ageMonths} calendar months old`,
    );
  }

  return {
    city,
    areaCount: areas.length,
    latestMonth,
    latestMonthCoverage: current.length,
    coverageRatio: Number(coverage.toFixed(4)),
    ageMonths,
  };
}

const [london, madrid] = await Promise.all([
  checkCity("london", CITY_RULES.london),
  checkCity("madrid", CITY_RULES.madrid),
]);

const located = await request("rpc/find_area_at_point", {
  method: "POST",
  body: JSON.stringify({
    p_lon: -0.1276,
    p_lat: 51.5079,
  }),
});
const madridLocated = await request("rpc/find_area_at_point", {
  method: "POST",
  body: JSON.stringify({
    p_lon: -3.7038,
    p_lat: 40.4168,
  }),
});

if (
  !Array.isArray(located) ||
  located.length !== 1 ||
  !located[0]?.area_id?.startsWith(CITY_RULES.london.stablePrefix) ||
  located[0]?.city_slug !== "london"
) {
  throw new Error(`Point lookup did not resolve central London to a stable area: ${JSON.stringify(located)}`);
}
if (
  !Array.isArray(madridLocated) ||
  madridLocated.length !== 1 ||
  !madridLocated[0]?.area_id?.startsWith(CITY_RULES.madrid.stablePrefix) ||
  madridLocated[0]?.city_slug !== "madrid"
) {
  throw new Error(`Point lookup did not resolve central Madrid to a stable area: ${JSON.stringify(madridLocated)}`);
}


const [madridMapMetrics, madridPopulation, madridActivity] = await Promise.all([
  request(
    "latest_area_map_metrics?select=area_id,period_start,population,violence_property_density_percentile,violence_property_resident_percentile&city_slug=eq.madrid&limit=500",
  ),
  request(
    "latest_area_population?select=area_id,period_start,population&area_id=like.es-madrid-neighbourhood:*&limit=500",
  ),
  request(
    "latest_area_activity_context?select=area_id,period_start,open_premises,open_hostelry&area_id=like.es-madrid-neighbourhood:*&limit=500",
  ),
]);

if (!Array.isArray(madridMapMetrics) || madridMapMetrics.length < 120) {
  throw new Error(`Madrid map metrics coverage is too low: ${madridMapMetrics?.length ?? "missing"}`);
}
for (const row of madridMapMetrics) {
  const densityPercentile = asFinite(
    row.violence_property_density_percentile,
    "Madrid violence/property density percentile",
  );
  if (densityPercentile < 0 || densityPercentile > 1) {
    throw new Error(`Out-of-range Madrid map percentile: ${densityPercentile}`);
  }
  if (row.population !== null) {
    const residentPercentile = asFinite(
      row.violence_property_resident_percentile,
      "Madrid violence/property resident percentile",
    );
    if (residentPercentile < 0 || residentPercentile > 1) {
      throw new Error(`Out-of-range Madrid resident percentile: ${residentPercentile}`);
    }
  }
}

function checkContextCoverage(rows, label, maxAgeMonths) {
  if (!Array.isArray(rows) || rows.length < 120) {
    throw new Error(`${label} coverage is too low: ${rows?.length ?? "missing"}`);
  }
  const latest = rows
    .map((row) => String(row.period_start ?? "").slice(0, 7))
    .sort()
    .at(-1);
  if (!latest) throw new Error(`Could not determine latest ${label} month`);
  const age = monthAge(latest);
  if (age < 0 || age > maxAgeMonths) {
    throw new Error(`${label} is stale or future-dated: ${latest} (age ${age} months)`);
  }
  return latest;
}

const madridPopulationMonth = checkContextCoverage(madridPopulation, "Madrid population context", 3);
const madridActivityMonth = checkContextCoverage(madridActivity, "Madrid commercial context", 4);

for (const row of madridActivity) {
  const openPremises = asFinite(row.open_premises, "Madrid open premises");
  const openHostelry = asFinite(row.open_hostelry, "Madrid open hostelry");
  if (openPremises < 0 || openHostelry < 0 || openHostelry > openPremises) {
    throw new Error(`Implausible Madrid commercial context: ${JSON.stringify(row)}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedAt: new Date().toISOString(),
      cities: [london, madrid],
      madridContext: {
        populationMonth: madridPopulationMonth,
        populationCoverage: madridPopulation.length,
        commercialMonth: madridActivityMonth,
        commercialCoverage: madridActivity.length,
      },
      pointLookup: {
        london: {
          areaId: located[0].area_id,
          sourceAreaId: located[0].source_area_id,
          name: located[0].name,
        },
        madrid: {
          areaId: madridLocated[0].area_id,
          sourceAreaId: madridLocated[0].source_area_id,
          name: madridLocated[0].name,
        },
      },
    },
    null,
    2,
  ),
);
