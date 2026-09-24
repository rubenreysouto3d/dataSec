const API = "https://datos.madrid.es/api/3/action";
const DATASET = "209163-0-padron-municipal-historico";

const months = new Map([
  ["enero", 1], ["febrero", 2], ["marzo", 3], ["abril", 4],
  ["mayo", 5], ["junio", 6], ["julio", 7], ["agosto", 8],
  ["septiembre", 9], ["octubre", 10], ["noviembre", 11], ["diciembre", 12],
]);

async function action(name, params) {
  const url = new URL(`${API}/${name}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { "User-Agent": "dataSec-source-health/0.2" } });
  if (!response.ok) throw new Error(`Madrid CKAN ${response.status}: ${name}`);
  const body = await response.json();
  if (!body.success) throw new Error(`Madrid CKAN action failed: ${name}`);
  return body.result;
}

function parseMonth(resource) {
  const text = `${resource.name ?? ""} ${resource.description ?? ""}`.toLowerCase();
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;
  for (const [name, month] of months) {
    if (text.includes(name)) return `${year}-${String(month).padStart(2, "0")}`;
  }
  return null;
}

const pkg = await action("package_show", { id: DATASET });
const resources = pkg.resources
  .filter((resource) => String(resource.format ?? "").toUpperCase() === "CSV")
  .map((resource) => ({ ...resource, month: parseMonth(resource) }))
  .filter((resource) => resource.month)
  .sort((a, b) => b.month.localeCompare(a.month));

if (!resources.length) throw new Error("No Madrid population CSV resources found");
const latest = resources[0];

const sample = await action("datastore_search", {
  resource_id: latest.id,
  limit: "1",
});
const expected = [
  "COD_DISTRITO", "COD_BARRIO", "ESPANOLESHOMBRES", "ESPANOLESMUJERES",
  "EXTRANJEROSHOMBRES", "EXTRANJEROSMUJERES",
];
const fields = new Set(sample.fields.map((field) => field.id));
for (const field of expected) {
  if (!fields.has(field)) throw new Error(`Missing Madrid population field: ${field}`);
}
if (sample.total < 100_000) throw new Error(`Implausibly low population row count: ${sample.total}`);

const [year, month] = latest.month.split("-").map(Number);
const now = new Date();
const ageMonths = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
if (ageMonths > 2) {
  throw new Error(`Madrid population source is stale: latest ${latest.month}`);
}

console.log(JSON.stringify({
  ok: true,
  latestMonth: latest.month,
  resourceId: latest.id,
  sourceRows: sample.total,
  fieldContract: expected.length,
}, null, 2));
