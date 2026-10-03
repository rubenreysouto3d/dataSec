const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function moduleAt(path) {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", js)(mod, mod.exports);
  return mod.exports;
}
const {v2Cities} = moduleAt("lib/v2-city-catalog.ts");
assert.ok(v2Cities.length >= 10, "Catalog must have a serious expansion pipeline");
assert.deepEqual(v2Cities.filter(c => c.status === "live").map(c => c.slug).sort(), ["london","madrid"],
  "Only cities with validated existing ingest may appear live");
assert.equal(new Set(v2Cities.map(c=>c.slug)).size, v2Cities.length, "Unique city slugs");
assert.ok(v2Cities.some(c=>c.slug==="barcelona" && c.status==="source-review" && c.source),
  "Barcelona incident source remains in review");
assert.ok(v2Cities.some(c=>c.slug==="paris" && c.status==="source-review" && c.source),
  "Paris geography must not be presented as validated offence data");
assert.ok(v2Cities.some(c=>c.slug==="manchester" && c.status==="research" && /no ofrece/.test(c.note)),
  "Must preserve known lack of GMP data on Police UK");

const home=fs.readFileSync("app/v2/V2Home.tsx","utf8");
const workspace=fs.readFileSync("app/v2/explore/[city]/V2Research.tsx","utf8");
const layout=fs.readFileSync("app/v2/layout.tsx","utf8");
assert.ok(home.includes("setPurpose") && home.includes("lookUpAddress") && home.includes("setCandidate(match)"));
assert.ok(home.includes("candidate.matchedPlace"), "Explicitly confirm the matching address");
assert.ok(home.includes('id="ciudades"'));
assert.ok(workspace.includes("createPlaceEvidenceContext"), "Shared canonical observed indicators");
assert.ok(workspace.includes('setTab("map")') && workspace.includes('setTab("compare")'));
assert.ok(workspace.includes("toggleSaved"), "Meaningful saved workflow");
assert.ok(workspace.includes("evidence.period"), "Observation period required for any evidence card");
assert.ok(layout.includes("index: false"), "Do not index concept/test cities");
console.log("DataSec v2 product contract: 14 assertions passed.");
