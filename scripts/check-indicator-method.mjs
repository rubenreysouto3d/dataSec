import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visitorExposureScore, buildVisitorPercentileMap } from "../lib/map-filters.ts";

const metric = (areaId, theftDensityPercentile, theftPerKm2, violencePropertyDensityPercentile) => ({
  areaId,
  theftDensityPercentile,
  theftPerKm2,
  violencePropertyDensityPercentile,
});

const rows = [
  metric("centre", 0.9, 80, 0.1),
  metric("outer", 0.2, 3, 0.95),
  metric("missing", null, null, 0.99),
  metric("measured-zero", 0, 0, 0.8),
];

assert.equal(visitorExposureScore(rows[0]), 0.9, "No hidden 70/30 blend");
assert.equal(visitorExposureScore(rows[1]), 0.2, "Violence/property doesn't secretly change visitor colour");
assert.equal(visitorExposureScore(rows[2]), null, "Missing theft data is missing even if another category exists");
assert.equal(visitorExposureScore(rows[3]), 0, "A measured zero must remain distinct from no data");

const scored = buildVisitorPercentileMap(rows);
assert.equal(scored.get("centre"), 0.9);
assert.equal(scored.get("outer"), 0.2);
assert.equal(scored.get("missing"), null);
assert.equal(scored.get("measured-zero"), 0);

const data = readFileSync(new URL("../lib/data.ts", import.meta.url), "utf8");
const view = readFileSync(new URL("../lib/map-view.ts", import.meta.url), "utf8");
const areaPage = readFileSync(new URL("../app/area/[id]/page.tsx", import.meta.url), "utf8");
const mapPage = readFileSync(new URL("../app/city/[city]/CityMap.tsx", import.meta.url), "utf8");
assert.ok(areaPage.includes("unstable_rethrow(error)"), "Next dynamic control-flow exceptions must not be swallowed");
assert.ok(areaPage.includes("await connection()"), "On-demand area profiles must await actual requests instead of static prerendering");
assert.ok(mapPage.includes("value === null || !Number.isFinite(value)"), "A finite recorded value must never be displayed as no data");
const policy = readFileSync(new URL("../docs/indicator-policy.md", import.meta.url), "utf8");
const categories = JSON.parse(readFileSync(
  new URL("../data/sources/madrid-personal-harm-categories.json", import.meta.url),
  "utf8",
));
assert.equal(categories.length, new Set(categories).size, "Duplicate Madrid categories");
assert.ok(categories.length >= 3);
assert.ok(categories.includes("madrid-dispatch-reyertas-agresiones"));
assert.ok(categories.includes("madrid-dispatch-robos-con-violencia-intimidacion"));
assert.ok(categories.includes("madrid-dispatch-violencia-de-genero-y-familiar"));
assert.ok(!categories.some((slug) => slug.includes("fallecidos-por-delito-o-causa-desconocida")),
  "Unknown-cause death isn't an explicitly personal-harm event");
const health = readFileSync(new URL("./check-data-store.mjs", import.meta.url), "utf8");
assert.ok(data.includes("MADRID_PERSONAL_HARM_CATEGORIES"), "App must use shared audited category list");
assert.ok(health.includes("madrid-personal-harm-categories.json"), "Data-health must use the same categories as the app");
assert.ok(!data.includes("contextualConcernPercentile"), "Legacy survey/incident blended percentile retired");
assert.ok(!view.includes("contextualConcernPercentile"), "Map may not silently reinstate the retired mixed signal");
assert.ok(policy.includes("Guindalera") && policy.includes("092"), "Administrative location anomaly remains documented");
assert.ok(policy.includes("population/footfall denominator") || policy.includes("visitor population/footfall denominator"));
console.log("Indicator method contract: fixtures, no-data distinction, source categories and provenance PASSED");
