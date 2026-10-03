const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
function transpile(path,requireMock){
  const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const module={exports:{}};
  new Function("require","module","exports",js)(requireMock,module,module.exports);
  return module.exports;
}
const report=transpile("lib/location-report.ts",require);
const choice=transpile("lib/address-choice.ts",name=>{
  if(name==="./location-report"||name==="@/lib/location-report")return report;
  throw Error("Unexpected runtime dependency: "+name);
});
const p=(lat,lng,label)=>({latitude:lat,longitude:lng,label,view:"visitor"});
const one=p(40.417,-3.704,"Puerta del Sol");
const two=p(40.430,-3.700,"Madrid address B");
const href=choice.choiceHref(one,two,"resident");
const params=new URL(href,"https://example.org").searchParams;
assert.equal(params.get("view"),"resident");
assert.equal(params.get("aplace"),"Puerta del Sol");
assert.equal(params.get("bplace"),"Madrid address B");
assert.equal(choice.choiceHref(one,null,"visitor").includes("blat"),false);
assert.equal(choice.readChoicePoint(Object.fromEntries(params),"a","resident").label,one.label);
assert.equal(choice.readChoicePoint(Object.fromEntries(params),"b","resident").view,"resident");
assert.equal(choice.readChoicePoint(Object.fromEntries(params),"b","resident").latitude,40.43);
assert.equal(choice.readChoicePoint({alat:"91",alng:"5"},"a","visitor"),null);
assert.equal(choice.sameExactPoint(one,p(40.41701,-3.70401,"same")),true);
assert.equal(choice.sameExactPoint(one,two),false);
const site=(city,id,period="2026-08",value=10,available=true,indicator="theft-density")=>({
  area:{citySlug:city,id},evidence:{period,value,available,indicator}
});
assert.equal(choice.comparisonKind(site("madrid","a"),site("madrid","a")),"same-area");
assert.equal(choice.comparisonKind(site("madrid","a"),site("madrid","b")),"comparable");
assert.equal(choice.comparisonKind(site("madrid","a"),site("london","b")),"different-city");
assert.equal(choice.comparisonKind(site("madrid","a"),site("madrid","b","2026-07")),"different-period");
assert.equal(choice.comparisonKind(site("madrid","a"),site("madrid","b","2026-08",null,false)),"unavailable");
assert.equal(choice.comparisonKind(site("madrid","a"),site("madrid","b","2026-08",10,true,"personal-harm")),"unavailable");
const client=fs.readFileSync("app/v2/choose/ChoiceClient.tsx","utf8");
const page=fs.readFileSync("app/v2/choose/page.tsx","utf8");
const nearby=fs.readFileSync("app/v2/api/nearby/route.ts","utf8");
assert.ok(client.includes("Comparar el entorno inmediato"));
assert.ok(client.includes("No convertir")||client.includes("no acreditan qué calle debes evitar"));
assert.ok(page.includes("locateAreaByCoordinates"));
assert.ok(page.includes("createPlaceEvidenceContext"));
assert.ok(nearby.includes("school|kindergarten")&&nearby.includes("park|playground"));
console.log("Address-choice contract: 21 checks passed.");
