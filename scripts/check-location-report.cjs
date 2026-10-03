const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
function readTS(path){
  const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const mod={exports:{}};
  new Function("module","exports",js)(mod,mod.exports);
  return mod.exports;
}
const report=readTS("lib/location-report.ts");
const nearby=readTS("lib/nearby-places.ts");
assert.equal(report.readReportPoint({lat:"",lng:"-3.70"}),null);
assert.equal(report.readReportPoint({lat:"Infinity",lng:"-3.70"}),null);
assert.equal(report.readReportPoint({lat:"91",lng:"-3.70"}),null);
assert.equal(report.readReportPoint({lat:"40.416",lng:"-181"}),null);
const point=report.readReportPoint({lat:"40.416",lng:"-3.703",place:"Sol, Madrid",view:"resident"});
assert.equal(point.latitude,40.416);
assert.equal(point.view,"resident");
const url=report.locationReportHref(point);
assert.equal(url.startsWith("/v2/report?"),true);
assert.equal(new URL(url,"https://example.org").searchParams.get("place"),"Sol, Madrid");
assert.ok(nearby.pointDistanceMeters(40,-3,40,-3)===0);
assert.ok(nearby.pointDistanceMeters(40,-3,40.001,-3)>100);
const places=nearby.tidyNearby([
  {type:"node",id:1,lat:40,lon:-3,tags:{name:"Prueba farmacia",amenity:"pharmacy"}},
  {type:"node",id:2,lat:40.001,lon:-3,tags:{name:"Supermercado",shop:"supermarket"}},
  {type:"node",id:3,lat:40,lon:-3,tags:{name:"Estación",railway:"subway_entrance"}},
  {type:"node",id:4,lat:40,lon:-3,tags:{name:"Hospital",amenity:"hospital"}},
  {type:"node",id:5,lat:40,lon:-3,tags:{name:"Rumour",amenity:"cafe"}},
  {type:"node",id:6,lat:42,lon:-3,tags:{name:"Too far",amenity:"pharmacy"}},
],40,-3);
assert.equal(places.length,4);
assert.deepEqual(places.map(p=>p.category),["transport","groceries","pharmacy","health"]);
assert.equal(places.some(p=>p.name==="Too far"),false);

const home=fs.readFileSync("app/v2/V2Home.tsx","utf8");
const route=fs.readFileSync("app/v2/report/page.tsx","utf8");
const api=fs.readFileSync("app/v2/api/nearby/route.ts","utf8");
const view=fs.readFileSync("app/v2/report/LocationReport.tsx","utf8");
assert.ok(home.includes("locationReportHref"),"Address must open a report, not a neighbourhood dashboard");
assert.ok(route.includes("locateAreaByCoordinates"),"Server verifies that the point belongs to a supported area");
assert.ok(route.includes("createPlaceEvidenceContext"),"Always reuse source-validated area evidence");
assert.ok(api.includes("toFixed(3)")&&api.includes("locateAreaByCoordinates"),"Bound private OSM fetch to approximate supported points");
assert.ok(view.includes("evidence.period")&&view.includes("alternatives"),"Show actual period and alternatives");
assert.ok(view.includes("no se atribuyen estos registros"),"No street-level attribution");
console.log("Location report: all 19 checks passed.");
