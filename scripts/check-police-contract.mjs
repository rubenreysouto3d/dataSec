const API = "https://data.police.uk/api";
const BASE = "https://data.police.uk";
const FORCE = "metropolitan";

function fail(message, details) {
  console.error(`CONTRACT_ERROR: ${message}`);
  if (details !== undefined) console.error(details);
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function retryable(status) {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url, init = {}, attempts = 4) {
  let lastResponse = null;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      lastResponse = response;
      if (response.ok || !retryable(response.status) || attempt === attempts - 1) {
        return response;
      }

      const retryAfter = Number(response.headers.get("retry-after") || "0");
      const delay = retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : 1_500 * 2 ** attempt;
      console.warn(`Transient HTTP ${response.status} for ${url}; retrying in ${delay}ms`);
      await sleep(delay);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      const delay = 1_500 * 2 ** attempt;
      console.warn(`Transient fetch failure for ${url}; retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function json(path) {
  const response = await fetchWithRetry(`${API}${path}`, {
    headers: { "User-Agent": "dataSec-source-health/0.2" },
  });
  if (!response.ok) fail(`${path} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) fail(`${path} did not return JSON`, contentType);
  return response.json();
}

function isCoordinate(point) {
  return point &&
    typeof point === "object" &&
    typeof point.latitude === "string" &&
    typeof point.longitude === "string" &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude));
}

const neighbourhoods = await json(`/${FORCE}/neighbourhoods`);
if (!Array.isArray(neighbourhoods) || neighbourhoods.length < 10) {
  fail("Metropolitan neighbourhood list is unexpectedly small or malformed", neighbourhoods?.length);
}

const sample = neighbourhoods.find((item) =>
  item && typeof item.id === "string" && typeof item.name === "string" && item.id && item.name
);
if (!sample) fail("No valid neighbourhood object found");

const detail = await json(`/${FORCE}/${encodeURIComponent(sample.id)}`);
if (
  !detail ||
  detail.id !== sample.id ||
  typeof detail.name !== "string" ||
  !isCoordinate(detail.centre)
) {
  fail("Neighbourhood detail contract changed", detail);
}

const boundary = await json(`/${FORCE}/${encodeURIComponent(sample.id)}/boundary`);
if (!Array.isArray(boundary) || boundary.length < 3 || !boundary.every(isCoordinate)) {
  fail("Neighbourhood boundary contract changed", {
    length: Array.isArray(boundary) ? boundary.length : null,
    sample: Array.isArray(boundary) ? boundary.slice(0, 2) : boundary,
  });
}

const dates = await json("/crimes-street-dates");
if (
  !Array.isArray(dates) ||
  dates.length < 6 ||
  dates.some((item) => !item || !/^\d{4}-\d{2}$/.test(item.date))
) {
  fail("Crime availability date contract changed", dates?.slice?.(0, 5));
}

const latestMonth = dates[0].date;
const archiveUrl = `${BASE}/data/boundaries/${latestMonth}.zip`;
const archive = await fetchWithRetry(archiveUrl, {
  method: "HEAD",
  headers: { "User-Agent": "dataSec-source-health/0.2" },
});
if (!archive.ok) {
  fail(`Latest monthly boundary archive returned HTTP ${archive.status}`, archiveUrl);
}
const archiveLength = Number(archive.headers.get("content-length") || "0");
if (archiveLength && archiveLength < 1_000_000) {
  fail("Latest monthly boundary archive is implausibly small", archiveLength);
}

console.log(JSON.stringify({
  ok: true,
  checked_at: new Date().toISOString(),
  force: FORCE,
  neighbourhood_count: neighbourhoods.length,
  sample_neighbourhood: { id: sample.id, name: sample.name },
  sample_boundary_points: boundary.length,
  latest_month: latestMonth,
  monthly_boundary_archive: {
    url: archiveUrl,
    content_length: archiveLength || null,
  },
}, null, 2));
