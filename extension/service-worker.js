const DATASEC_ORIGIN = "https://data-sec.vercel.app";
const SUPABASE_URL = "https://pjyaevghxbimhknvmbxb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5PkZoLjbXCuItBfzftrkw_KMLJB8E3";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_GEOCODE_INTERVAL_MS = 1100;

let lastGeocodeAt = 0;

function normalizeLocale(value) {
  return value === "es" ? "es" : "en";
}

function cacheKey(candidate) {
  return `datasec-place-v2:${candidate.trim().toLowerCase().slice(0, 220)}`;
}

async function cached(candidate) {
  const key = cacheKey(candidate);
  const stored = await chrome.storage.local.get(key);
  const item = stored[key];
  if (!item || Date.now() - item.savedAt > CACHE_TTL_MS) return undefined;
  return item.value ?? null;
}

async function store(candidate, value) {
  const key = cacheKey(candidate);
  await chrome.storage.local.set({
    [key]: { savedAt: Date.now(), value },
  });
}

function pathId(areaId) {
  return encodeURIComponent(String(areaId).replace(/:/g, "~"));
}

function decorate(raw, locale) {
  if (!raw) return null;
  const id = pathId(raw.areaId);
  const localizedPrefix = locale === "es" ? "/es" : "";

  return {
    ...raw,
    widgetUrl: `${DATASEC_ORIGIN}/widget/${id}?view=visitor&lang=${locale}`,
    profileUrl: `${DATASEC_ORIGIN}${localizedPrefix}/area/${id}`,
  };
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

  return {
    areaId: row.area_id,
    areaName: row.name,
    citySlug: row.city_slug,
  };
}

async function waitForGeocodeSlot() {
  const delay = Math.max(0, MIN_GEOCODE_INTERVAL_MS - (Date.now() - lastGeocodeAt));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
  lastGeocodeAt = Date.now();
}

async function nominatim(candidate, locale) {
  await waitForGeocodeSlot();

  const params = new URLSearchParams({
    q: candidate,
    format: "jsonv2",
    limit: "5",
    countrycodes: "gb,es",
    addressdetails: "1",
    "accept-language": locale === "es" ? "es" : "en",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Nominatim lookup failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveCandidate(candidate, locale) {
  const hit = await cached(candidate);
  if (hit !== undefined) return decorate(hit, locale);

  const results = await nominatim(candidate, locale);
  for (const result of results) {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const area = await areaAtPoint(latitude, longitude);
    if (!area) continue;

    const raw = {
      ...area,
      matchedPlace: result.display_name || candidate,
    };
    await store(candidate, raw);
    return decorate(raw, locale);
  }

  await store(candidate, null);
  return null;
}

async function resolveCandidates(candidates, locale) {
  for (const candidate of candidates) {
    try {
      const result = await resolveCandidate(candidate, locale);
      if (result) return result;
    } catch (error) {
      console.warn("dataSec extension lookup failed", error);
    }
  }
  return null;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get("enabled");
  if (typeof stored.enabled !== "boolean") {
    await chrome.storage.local.set({ enabled: true });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "datasec:resolve-place") return false;

  const candidates = Array.isArray(message.candidates)
    ? message.candidates
        .filter((value) => typeof value === "string" && value.trim())
        .slice(0, 5)
    : [];
  const locale = normalizeLocale(message.locale);

  resolveCandidates(candidates, locale)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
