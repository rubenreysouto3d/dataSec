const API = "https://datos.madrid.es/api/3/action";
const DATASET = "837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal";
const AREA_RESOURCE = "300496-4-barrios-madrid";

const expectedIncidentFields = [
  "Dia de creacion",
  "Hora de creacion",
  "Distrito",
  "Barrio",
  "Origen",
  "Incidentes",
  "Descripcion tipo de apertura",
];

const expectedAreaFields = [
  "CODDIS",
  "NOMDIS",
  "COD_BAR",
  "NOMBRE",
  "BARRIO_MAY",
  "COD_DISBAR",
];

const months = new Map([
  ["enero", 1],
  ["febrero", 2],
  ["marzo", 3],
  ["abril", 4],
  ["mayo", 5],
  ["junio", 6],
  ["julio", 7],
  ["agosto", 8],
  ["septiembre", 9],
  ["octubre", 10],
  ["noviembre", 11],
  ["diciembre", 12],
]);

async function action(name, params) {
  const url = new URL(`${API}/${name}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "User-Agent": "dataSec-source-health/0.1" },
  });
  if (!response.ok) throw new Error(`Madrid CKAN ${response.status}: ${name}`);
  const body = await response.json();
  if (!body.success) throw new Error(`Madrid CKAN action failed: ${name}`);
  return body.result;
}

function parseMonth(resource) {
  const text = `${resource.name ?? ""} ${resource.description ?? ""}`.toLowerCase();
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  for (const [name, month] of months) {
    if (text.includes(name)) return `${yearMatch[1]}-${String(month).padStart(2, "0")}`;
  }
  return null;
}

const pkg = await action("package_show", { id: DATASET });
const monthly = pkg.resources
  .filter((resource) => String(resource.format ?? "").toUpperCase() === "CSV")
  .map((resource) => ({ ...resource, month: parseMonth(resource) }))
  .filter((resource) => resource.month)
  .sort((a, b) => b.month.localeCompare(a.month));

if (monthly.length === 0) throw new Error("No monthly Madrid incident CSV resources found");

const latest = monthly[0];
const sample = await action("datastore_search", {
  resource_id: latest.id,
  limit: "1",
});

if (sample.total < 1_000) {
  throw new Error(`Implausibly low Madrid incident row count: ${sample.total}`);
}

const incidentFields = new Set(sample.fields.map((field) => field.id));
for (const field of expectedIncidentFields) {
  if (!incidentFields.has(field)) throw new Error(`Missing Madrid incident field: ${field}`);
}

const areaSample = await action("datastore_search", {
  resource_id: AREA_RESOURCE,
  limit: "200",
});
if (areaSample.total !== 131) {
  throw new Error(`Expected 131 Madrid neighbourhoods, got ${areaSample.total}`);
}
const areaFields = new Set(areaSample.fields.map((field) => field.id));
for (const field of expectedAreaFields) {
  if (!areaFields.has(field)) throw new Error(`Missing Madrid area field: ${field}`);
}

const distinctSql = `
  SELECT "Descripcion tipo de apertura" AS category,
         SUM(CAST("Incidentes" AS INTEGER)) AS incidents
  FROM "${latest.id}"
  GROUP BY 1
  ORDER BY 2 DESC
`;
const categoryResult = await action("datastore_search_sql", {
  sql: distinctSql,
});
const categories = categoryResult.records.map((row) => ({
  category: row.category,
  incidents: Number(row.incidents),
}));

if (categories.length < 5) {
  throw new Error(`Implausibly low Madrid category count: ${categories.length}`);
}

console.log(JSON.stringify({
  ok: true,
  latestMonth: latest.month,
  latestResourceId: latest.id,
  rowCount: sample.total,
  areaCount: areaSample.total,
  categoryCount: categories.length,
  categories,
}, null, 2));
