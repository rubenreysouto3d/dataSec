// Test the real TypeScript modules with their runtime imports, no mock indicator math.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const i18n = { tr: (locale, en, es) => locale === "es" ? es : en };
function load(path, deps = {}) {
  const source = fs.readFileSync(path, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (js.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, "Transpile errors in " + path);
  const mod = { exports: {} };
  const requireDependency = (id) => {
    if (Object.hasOwn(deps, id)) return deps[id];
    throw new Error("Unexpected import " + id + " from " + path);
  };
  new Function("require", "module", "exports", js.outputText)(
    requireDependency, mod, mod.exports,
  );
  return mod.exports;
}
const filters = load("lib/map-filters.ts");
const mapView = load("lib/map-view.ts", { "@/lib/i18n": i18n });
const place = load("lib/place-evidence.ts", {
  "@/lib/map-filters": filters, "@/lib/map-view": mapView, "@/lib/i18n": i18n,
});

function metric(areaId) {
  return {
    areaId, citySlug: "madrid", month: "2026-07",
    theftPerKm2: 4.5, theftCount: 12, theftDensityPercentile: .8,
    violencePropertyPer10k: 6.2, violencePropertyCount: 10,
    violencePropertyResidentPercentile: .4,
  };
}
const a = {
  areaId: "a", months: 4, residentPercentile: .24,
  personalHarmPer10k: 1.1, personalHarmCount: 6,
  monthStart: "2026-03", monthEnd: "2026-06",
};
const b = {
  ...a, areaId: "b", months: 2, residentPercentile: .61,
  personalHarmPer10k: .9,
};
const metrics = [metric("a"), metric("b")];
const madrid = place.createPlaceEvidenceContext("madrid", metrics, [a,b]);
assert.equal(madrid.hasCityHarmSeries, true);
const observed = madrid.read("a", "resident");
assert.equal(observed.indicator, "personal-harm");
assert.equal(observed.value, 1.1);
assert.equal(observed.period, "2026-03 – 2026-06");
assert.equal(observed.available, true);
const insufficient = madrid.read("b", "resident");
assert.equal(insufficient.indicator, "personal-harm");
assert.equal(insufficient.available, false, "must never replace missing harm with a different measure");
assert.equal(insufficient.value, null);
assert.equal(insufficient.period, null);
const visitor = madrid.read("b", "visitor");
assert.equal(visitor.indicator, "theft-density");
assert.equal(visitor.available, true);
assert.equal(visitor.period, "2026-07");
assert.equal(visitor.value, 4.5);
const fallback = place.createPlaceEvidenceContext("madrid", metrics, [b]);
assert.equal(fallback.hasCityHarmSeries, false);
assert.equal(fallback.read("b", "resident").indicator, "violence-property-resident");
assert.equal(fallback.read("b", "resident").value, 6.2);
const london = place.createPlaceEvidenceContext("london", metrics, []);
assert.equal(london.read("a", "resident").indicator, "violence-property-resident");
assert.equal(london.read("a", "resident").period, "2026-07");
const missing = london.read("unmapped", "visitor");
assert.equal(missing.available, false);
assert.equal(missing.value, null);
assert.equal(missing.period, null);
assert.match(place.placeEvidenceLabel("madrid", "visitor", false, "es"), /km²/);
assert.equal(place.placeEvidenceSource("london", "en").url, "https://data.police.uk/about/");
console.log("Place evidence contract: 19 assertions passed.");
