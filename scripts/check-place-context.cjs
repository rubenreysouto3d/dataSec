const fs=require("fs");
const assert=require("assert");

const context=fs.readFileSync("lib/place-context.ts","utf8");
const data=fs.readFileSync("lib/data.ts","utf8");
const madrid=fs.readFileSync("scripts/ingest_madrid.py","utf8");
const streetRoute=fs.readFileSync("app/v2/api/street-context/route.ts","utf8");

for(const lens of [
  "overview","choosing_stay","arriving_late","around_me","tonight","living_here","living_with_family"
]){
  assert.ok(context.includes('"'+lens+'"'),"Missing place-context lens: "+lens);
}
assert.ok(context.includes("methodVersion"),"Findings must carry a method version");
assert.ok(context.includes("confidence"),"Findings must carry evidence confidence");
assert.ok(context.includes("limitations"),"Place Context must expose limitations");
assert.ok(!/safetyScore|overallScore|dangerScore/.test(context),
  "Place Context must not collapse evidence into a universal score");

assert.ok(data.includes('"city_capabilities"'),"Read model must expose city capability manifests");
assert.ok(data.includes('"temporal_observations"'),"Read model must expose temporal observations");
assert.ok(context.includes("madridPersonalHarmMetricSlugs"),
  "Time-of-day findings must use the reviewed Madrid safety taxonomy, not all dispatch activity");

assert.ok(madrid.includes("parse_creation_hour"),"Madrid ingestion must preserve the source creation hour");
assert.ok(madrid.includes('"temporal_observation"'),"Madrid ingestion must stage temporal evidence atomically");
assert.ok(madrid.includes("reviewed-hour aggregation mismatch") && madrid.includes("PERSONAL_HARM_METRIC_SLUGS"),
  "Madrid ingestion must verify reviewed temporal totals against the corresponding monthly metrics");

assert.ok(streetRoute.includes("getStreetContext"),
  "Street route must reuse the canonical street evidence module");

console.log("place-context contracts: ok");
