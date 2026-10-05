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
assert.ok(home.includes("setPurpose") && home.includes("searchAddress") && home.includes("setCandidate(match)"));
assert.ok(home.includes("candidate.matchedPlace"), "Explicitly confirm the matching address");
const productPage=fs.readFileSync("app/v2/page.tsx","utf8");
assert.ok(productPage.includes('redirect("/v2/explore/madrid?view=visitor")'), "The product enters the spatial workspace directly");
const citiesPage=fs.readFileSync("app/v2/cities/page.tsx","utf8");
assert.ok(citiesPage.includes("v2Cities") && home.includes("/v2/cities"),"Coverage has its own directory");
assert.ok(workspace.includes("createPlaceEvidenceContext"), "Shared canonical observed indicators");
assert.ok(workspace.includes("<AtlasMap"), "The map is the persistent application surface");
assert.ok(workspace.includes("selectedPoint={selectedPoint}"), "Exact places remain inside the map workspace");
assert.ok(workspace.includes('/v2/api/nearby'), "Exact points enrich the same workspace with nearby context");
assert.ok(!workspace.includes("type Tab"), "The main city experience must not regress to page-like tabs");
assert.ok(!workspace.includes('["compare","Comparar"]'), "Zone comparison must not be a primary explorer mode");
assert.ok(workspace.includes("toggleSaved"), "Meaningful saved workflow");
const serverPage = fs.readFileSync("app/v2/explore/[city]/page.tsx","utf8");
const boundaryRoute = fs.readFileSync("app/v2/api/boundaries/[city]/route.ts","utf8");
assert.ok(!serverPage.includes("getCityBoundaries"), "Initial dossier must not serialise expensive city maps");
assert.ok(workspace.includes('fetch("/v2/api/boundaries/" + city)'), "Load geometry only when opening map tab");
assert.ok(boundaryRoute.includes("getCityBoundaries"), "Dedicated optional geometry endpoint");

assert.ok(workspace.includes("evidence.period"), "Observation period required for any evidence card");
assert.ok(layout.includes("index: false"), "Do not index concept/test cities");
console.log("DataSec v2 product contract: spatial-app assertions passed.");
