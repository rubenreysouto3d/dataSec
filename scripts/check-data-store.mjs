const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";

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

const areas = await request(
  "areas?select=id,source_area_id,name&city_slug=eq.london&active=eq.true&limit=1",
);
if (!Array.isArray(areas) || areas.length !== 1) {
  throw new Error("Public areas endpoint returned no London area");
}

const contexts = await request(
  "area_month_context?select=area_id,period_start,total_incidents&city_slug=eq.london&limit=1",
);
const madridAreas = await request(
  "areas?select=id,source_area_id,name&city_slug=eq.madrid&area_type=eq.municipal_neighbourhood&active=eq.true&limit=1",
);
const latestContexts = await request(
  "latest_area_context?select=area_id,city_slug,period_start,total_incidents&limit=2",
);
if (!Array.isArray(contexts) || contexts.length !== 1) {
  throw new Error("Public area_month_context returned no London context");
}
if (!Array.isArray(madridAreas) || madridAreas.length !== 1) {
  throw new Error("Public areas endpoint returned no Madrid neighbourhood");
}
if (!Array.isArray(latestContexts) || latestContexts.length < 1) {
  throw new Error("Public latest_area_context returned no rows");
}

const located = await request("rpc/find_area_at_point", {
  method: "POST",
  body: JSON.stringify({
    p_lon: -0.1276,
    p_lat: 51.5079,
  }),
});
if (!Array.isArray(located) || located.length !== 1 || !located[0]?.source_area_id || located[0]?.city_slug !== "london") {
  throw new Error(`Point lookup did not resolve central London: ${JSON.stringify(located)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sampleArea: areas[0],
      sampleContext: contexts[0],
      sampleMadridArea: madridAreas[0],
      sampleLatestContext: latestContexts[0],
      pointLookup: located[0],
    },
    null,
    2,
  ),
);
