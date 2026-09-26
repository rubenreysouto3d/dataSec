const DATASEC_ORIGIN = "https://data-sec.vercel.app";
const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(candidate) {
  return `datasec-place:${candidate.trim().toLowerCase().slice(0, 220)}`;
}

async function cached(candidate) {
  const key = cacheKey(candidate);
  const stored = await chrome.storage.local.get(key);
  const item = stored[key];
  if (!item || Date.now() - item.savedAt > CACHE_TTL_MS) return null;
  return item.value ?? null;
}

async function store(candidate, value) {
  const key = cacheKey(candidate);
  await chrome.storage.local.set({
    [key]: { savedAt: Date.now(), value },
  });
}

async function areaAtPoint(latitude, longitude) {
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
    throw new Error(`dataSec boundary lookup failed: ${response.status}`);
  }

  const rows = await response.json();
  const row = rows?.[0];
  if (!row) return null;

  const pathId = encodeURIComponent(String(row.area_id).replace(/:/g, "~"));
  return {
    areaId: row.area_id,
    areaName: row.name,
    citySlug: row.city_slug,
    widgetUrl: `${DATASEC_ORIGIN}/widget/${pathId}?view=visitor`,
    profileUrl: `${DATASEC_ORIGIN}/area/${pathId}`,
  };
}

async function resolveCandidate(candidate) {
  const hit = await cached(candidate);
  if (hit) return hit;

  const params = new URLSearchParams({
    q: candidate,
    format: "jsonv2",
    limit: "5",
    countrycodes: "gb,es",
    addressdetails: "1",
    "accept-language": "en",
  });

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim lookup failed: ${response.status}`);
  }

  const results = await response.json();
  for (const result of results) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const area = await areaAtPoint(latitude, longitude);
    if (!area) continue;

    const value = {
      ...area,
      matchedPlace: result.display_name || candidate,
    };
    await store(candidate, value);
    return value;
  }

  await store(candidate, null);
  return null;
}

async function resolveCandidates(candidates) {
  for (const candidate of candidates) {
    try {
      const result = await resolveCandidate(candidate);
      if (result) return result;
    } catch (error) {
      console.warn("dataSec extension lookup failed", error);
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "datasec:resolve-place") return false;

  const candidates = Array.isArray(message.candidates)
    ? message.candidates.filter((value) => typeof value === "string" && value.trim()).slice(0, 8)
    : [];

  resolveCandidates(candidates)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
