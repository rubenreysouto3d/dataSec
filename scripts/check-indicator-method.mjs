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
const policy = readFileSync(new URL("../docs/indicator-policy.md", import.meta.url), "utf8");
const allowedSection = data.split("const MADRID_PERSONAL_HARM_SLUGS = new Set([")[1]?.split("]);")[0];
assert.ok(allowedSection, "Explicit Madrid personal-harm source category list required");
assert.ok(allowedSection.includes("reyertas-agresiones"));
assert.ok(allowedSection.includes("robos-con-violencia-intimidacion"));
assert.ok(allowedSection.includes("violencia-de-genero-y-familiar"));
assert.ok(!allowedSection.includes("fallecidos-por-delito-o-causa-desconocida"), "Unknown-cause death isn't an explicit personal-harm event");
assert.ok(!data.includes("contextualConcernPercentile"), "Legacy survey/incident blended percentile retired");
assert.ok(!view.includes("contextualConcernPercentile"), "Map may not silently reinstate the retired mixed signal");
assert.ok(policy.includes("Guindalera") && policy.includes("092"), "Administrative location anomaly remains documented");
assert.ok(policy.includes("population/footfall denominator") || policy.includes("visitor population/footfall denominator"));
console.log("Indicator method contract: fixtures, no-data distinction, source categories and provenance PASSED");
