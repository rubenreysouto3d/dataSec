import { locateAreaByCoordinates } from "@/lib/public-data-client";

export const dynamic = "force-dynamic";

type PoliceCrime = {
  category?: string;
  month?: string;
  location?: {
    latitude?: string;
    longitude?: string;
    street?: { id?: number; name?: string };
  } | null;
};

type HotspotSignal = "theft" | "drugs" | "disorder" | "violence";

function monthOffset(month:string,delta:number){
  const [year,value]=month.split("-").map(Number);
  const date=new Date(Date.UTC(year,value-1+delta,1));
  return date.getUTCFullYear()+"-"+String(date.getUTCMonth()+1).padStart(2,"0");
}

function signalOf(category:string):HotspotSignal|null {
  if(category==="theft-from-the-person"||category==="robbery")return "theft";
  if(category==="drugs")return "drugs";
  if(category==="anti-social-behaviour"||category==="public-order")return "disorder";
  if(category==="violent-crime"||category==="violence-and-sexual-offences")return "violence";
  return null;
}

function signalLabel(signal:HotspotSignal){
  if(signal==="theft")return "Hurto / robo a personas";
  if(signal==="drugs")return "Drogas";
  if(signal==="disorder")return "Desorden / conducta antisocial";
  return "Violencia";
}
function distanceMeters(aLat:number,aLng:number,bLat:number,bLng:number){
  const r=Math.PI/180;
  const dLat=(bLat-aLat)*r,dLng=(bLng-aLng)*r;
  const q=Math.sin(dLat/2)**2+Math.cos(aLat*r)*Math.cos(bLat*r)*Math.sin(dLng/2)**2;
  return Math.round(12742000*Math.asin(Math.min(1,Math.sqrt(q))));
}
function publicLocationLabel(value:string){
  const raw=value.trim()||"Ubicación aproximada";
  const cleaned=raw.replace(/^On or near\s+/i,"").trim();
  const generic=new Set([
    "Police Station","Hospital","Nightclub","Further/higher Educational Building",
    "Conference/exhibition Centre","Theatre/concert Hall","Parking Area","Shopping Area",
  ]);
  return {
    label:cleaned,
    generic:generic.has(cleaned),
  };
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const latitude=Number(url.searchParams.get("lat"));
  const longitude=Number(url.searchParams.get("lng"));
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
    latitude < -90||latitude > 90||longitude < -180||longitude > 180){
    return Response.json({error:"Invalid location"},{status:400});
  }

  const covered=await locateAreaByCoordinates(latitude,longitude);
  if(!covered){
    return Response.json({availability:"unsupported",hotspots:[]},{status:404});
  }

  if(covered.citySlug!=="london"){
    return Response.json({
      availability:"area-only",
      city:covered.citySlug,
      areaId:covered.id,
      areaName:covered.name,
      hotspots:[],
      note:"La fuente oficial disponible para esta ciudad no publica ubicación de calle suficientemente precisa.",
    },{headers:{"Cache-Control":"public, s-maxage=3600, stale-while-revalidate=3600","X-Robots-Tag":"noindex"}});
  }

  try{
    // Quantise user coordinates before sending them to the external police API.
    // ~0.001° is roughly 100 m and is enough for its 1-mile query radius.
    const lat=Number(latitude.toFixed(3));
    const lng=Number(longitude.toFixed(3));

    const updated=await fetch("https://data.police.uk/api/crime-last-updated",{
      headers:{"Accept":"application/json","User-Agent":"dataSec/0.5 (https://data-sec.vercel.app)"},
      next:{revalidate:43200},
      signal:AbortSignal.timeout(10000),
    });
    if(!updated.ok)throw new Error("crime update unavailable");
    const updatePayload=await updated.json() as {date?:string};
    const latest=(updatePayload.date||"").slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(latest))throw new Error("invalid latest month");
    const months=[monthOffset(latest,-2),monthOffset(latest,-1),latest];

    const responses=await Promise.all(months.map(async month=>{
      const endpoint=new URL("https://data.police.uk/api/crimes-street/all-crime");
      endpoint.searchParams.set("lat",String(lat));
      endpoint.searchParams.set("lng",String(lng));
      endpoint.searchParams.set("date",month);
      const response=await fetch(endpoint.toString(),{
        headers:{"Accept":"application/json","User-Agent":"dataSec/0.5 (https://data-sec.vercel.app)"},
        next:{revalidate:43200},
        signal:AbortSignal.timeout(14000),
      });
      if(!response.ok)throw new Error("street crime unavailable");
      const payload=await response.json();
      if(!Array.isArray(payload))throw new Error("unexpected street crime payload");
      return payload as PoliceCrime[];
    }));

    const grouped=new Map<string,{
      id:string;latitude:number;longitude:number;street:string;generic:boolean;
      signals:Record<HotspotSignal,number>;
      months:Set<string>;
    }>();

    for(const rows of responses){
      for(const row of rows){
        const signal=signalOf(String(row.category||""));
        if(!signal||!row.location)continue;
        const hLat=Number(row.location.latitude);
        const hLng=Number(row.location.longitude);
        const streetId=row.location.street?.id;
        const publicLabel=publicLocationLabel(row.location.street?.name||"Ubicación aproximada");
        if(!Number.isFinite(hLat)||!Number.isFinite(hLng)||streetId===undefined)continue;
        const key=String(streetId);
        const current=grouped.get(key)??{
          id:key,latitude:hLat,longitude:hLng,street:publicLabel.label,generic:publicLabel.generic,
          signals:{theft:0,drugs:0,disorder:0,violence:0},
          months:new Set<string>(),
        };
        current.signals[signal]+=1;
        if(row.month)current.months.add(row.month);
        grouped.set(key,current);
      }
    }

    const ranked=[...grouped.values()].map(item=>{
      const total=item.signals.theft+item.signals.drugs+item.signals.disorder+item.signals.violence;
      const primary=(Object.entries(item.signals) as Array<[HotspotSignal,number]>)
        .sort((a,b)=>b[1]-a[1])[0]?.[0]??"disorder";
      return {
        id:item.id,
        latitude:item.latitude,
        longitude:item.longitude,
        street:item.street,
        total,
        primary,
        primaryLabel:signalLabel(primary),
        signals:item.signals,
        months:item.months.size,
        repeated:item.months.size>=2,
        distanceMeters:distanceMeters(latitude,longitude,item.latitude,item.longitude),
        locationKind:item.generic?"anonymised-reference":"street-reference",
      };
    }).filter(item=>item.total>=2).sort((a,b)=>b.total-a.total);

    const max=Math.max(1,...ranked.map(item=>item.total));
    const hotspots=ranked.slice(0,45).map((item,index)=>({
      ...item,
      concentration:item.total>=Math.max(6,max*.55)?"high":item.total>=Math.max(3,max*.25)?"medium":"low",
      localRank:index+1,
    }));

    return Response.json({
      availability:"street",
      city:"london",
      areaId:covered.id,
      areaName:covered.name,
      latestMonth:latest,
      months,
      radius:"1 mile from an approximately 100 m-quantised query point",
      locationPrecision:"Police.UK publishes anonymised approximate street locations, not exact incident addresses.",
      hotspots,
      categories:{
        theft:"Hurto a personas + robo (incluye carterismo, pero la fuente no lo separa)",
        drugs:"Drogas",
        disorder:"Conducta antisocial + orden público",
        violence:"Violencia",
      },
      source:{label:"data.police.uk",url:"https://data.police.uk/",licence:"Open Government Licence v3.0"},
    },{
      headers:{"Cache-Control":"public, s-maxage=21600, stale-while-revalidate=21600","X-Robots-Tag":"noindex"}
    });
  }catch(error){
    console.error("Street context unavailable",error);
    return Response.json({error:"Street context temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
