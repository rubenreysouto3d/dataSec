import { locateAreaByCoordinates } from "@/lib/public-data-client";
import { readReportPoint } from "@/lib/location-report";
import { tidyNearby } from "@/lib/nearby-places";

export const dynamic = "force-dynamic";
const overpass = process.env.DATASEC_OVERPASS_ENDPOINT || "https://overpass-api.de/api/interpreter";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const point = readReportPoint({
    lat:url.searchParams.get("lat")??undefined,
    lng:url.searchParams.get("lng")??undefined,
  });
  if(!point) return Response.json({error:"Invalid location"}, {status:400});
  try {
    // Restrict demo queries to cities that dataSec can actually inspect.
    const covered=await locateAreaByCoordinates(point.latitude,point.longitude);
    if(!covered) return Response.json({error:"Unsupported city"}, {status:404});
    // Quantise to ~100 m for a bounded cache key and privacy: the external
    // volunteer service never receives the user's full street address.
    const lat=Number(point.latitude.toFixed(3));
    const lng=Number(point.longitude.toFixed(3));
    const query=`[out:json][timeout:12];
(
nwr["amenity"~"^(pharmacy|clinic|hospital)$"](around:750,${lat},${lng});
nwr["shop"~"^(supermarket|convenience)$"](around:750,${lat},${lng});
nwr["railway"~"^(station|subway_entrance)$"](around:750,${lat},${lng});
nwr["amenity"~"^(school|kindergarten)$"](around:750,${lat},${lng});
nwr["leisure"~"^(park|playground)$"](around:750,${lat},${lng});
);
out center 320;`;
    const endpoint=new URL(overpass);
    endpoint.searchParams.set("data",query);
    const response=await fetch(endpoint.toString(), {
      headers: { "Accept":"application/json", "User-Agent":"dataSec/0.4 (https://data-sec.vercel.app)" },
      next:{revalidate:86400},
      signal:AbortSignal.timeout(16000),
    });
    if(!response.ok) throw new Error("OSM context temporarily unavailable");
    const data=(await response.json()) as {elements?:unknown};
    if(!Array.isArray(data.elements)) throw new Error("Unexpected OSM response");
    return Response.json({
      source:"OpenStreetMap / Overpass",
      attribution:"© OpenStreetMap contributors (ODbL)",
      completeness:"OpenStreetMap is community maintained. Missing places are not proof that a service does not exist.",
      distance:"Approximate straight-line metres; not walking distance.",
      places:tidyNearby(data.elements,point.latitude,point.longitude),
    },{headers:{"Cache-Control":"public, s-maxage=3600, stale-while-revalidate=3600","X-Robots-Tag":"noindex"}});
  } catch(error) {
    console.error("Optional nearby data unavailable",error);
    return Response.json({error:"Optional map services temporarily unavailable"},{
      status:503,headers:{"Cache-Control":"no-store"},
    });
  }
}
