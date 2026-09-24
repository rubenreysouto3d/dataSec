const API = "https://datos.madrid.es/api/3/action";
const INCIDENT_DATASET = "837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal";
const ACTIVITY_DATASET = "209548-0-censo-locales-historico";

const months = new Map([
  ["enero",1],["febrero",2],["marzo",3],["abril",4],["mayo",5],["junio",6],
  ["julio",7],["agosto",8],["septiembre",9],["octubre",10],["noviembre",11],["diciembre",12],
]);

async function action(name, params) {
  const url = new URL(`${API}/${name}`);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  const response = await fetch(url,{headers:{"User-Agent":"dataSec-source-health/0.3"}});
  if (!response.ok) throw new Error(`Madrid CKAN ${response.status}: ${name}`);
  const body = await response.json();
  if (!body.success) throw new Error(`Madrid CKAN action failed: ${name}`);
  return body.result;
}

function parseMonth(resource) {
  const text = `${resource.name ?? ""} ${resource.description ?? ""}`.toLowerCase();
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  if (!year) return null;
  for (const [name,month] of months) {
    if (text.includes(name)) return `${year}-${String(month).padStart(2,"0")}`;
  }
  return null;
}

const incidents = await action("package_show",{id:INCIDENT_DATASET});
const incidentMonths = incidents.resources
  .filter((resource)=>String(resource.format ?? "").toUpperCase()==="CSV")
  .map((resource)=>parseMonth(resource))
  .filter(Boolean)
  .sort();
const targetMonth = incidentMonths.at(-1);
if (!targetMonth) throw new Error("No Madrid incident month available");

const activity = await action("package_show",{id:ACTIVITY_DATASET});
const matches = activity.resources
  .filter((resource)=>String(resource.format ?? "").toUpperCase()==="CSV")
  .map((resource)=>({...resource,month:parseMonth(resource)}))
  .filter((resource)=>resource.month===targetMonth && /actividades/i.test(String(resource.name ?? "")));

if (matches.length !== 1) {
  throw new Error(`Expected one Actividades CSV for ${targetMonth}, got ${matches.length}`);
}
const resource = matches[0];
const sample = await action("datastore_search",{resource_id:resource.id,limit:"3"});
if (!sample.total || sample.total < 1000) throw new Error(`Implausibly low activity rows: ${sample.total}`);

console.log(JSON.stringify({
  ok:true,
  targetMonth,
  resourceId:resource.id,
  resourceName:resource.name,
  total:sample.total,
  fields:sample.fields.map((field)=>field.id),
  sample:sample.records.slice(0,2),
},null,2));
