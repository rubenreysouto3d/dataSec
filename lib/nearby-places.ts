/**
 * OSM amenities are volunteer-maintained, not an authoritative services census.
 * Distance is straight-line from the searched point, not a walking journey.
 */
export type NearbyCategory = "transport" | "pharmacy" | "groceries" | "health";
export type NearbyPlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  distanceMeters: number;
  latitude: number;
  longitude: number;
};
type Element = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string,string>;
};

export function pointDistanceMeters(aLat:number,aLng:number,bLat:number,bLng:number) {
  const r = Math.PI / 180;
  const dLat = (bLat-aLat)*r, dLng = (bLng-aLng)*r;
  const q = Math.sin(dLat/2)**2+Math.cos(aLat*r)*Math.cos(bLat*r)*Math.sin(dLng/2)**2;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));
}

function categoryOf(tags: Record<string,string>): NearbyCategory | null {
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "hospital" || tags.amenity === "clinic") return "health";
  if (tags.shop === "supermarket" || tags.shop === "convenience") return "groceries";
  if (tags.railway === "subway_entrance" || tags.railway === "station" ||
    tags.station === "subway") return "transport";
  return null;
}

export function tidyNearby(elements: Element[],lat:number,lng:number):NearbyPlace[] {
  const distinct = new Map<string,NearbyPlace>();
  for (const e of elements) {
    const tags=e.tags??{};
    const category=categoryOf(tags);
    const pos=e.center ?? (e.lat!==undefined && e.lon!==undefined
      ? {lat:e.lat,lon:e.lon} : null);
    const name=tags.name?.trim();
    if (!category || !pos || !name || name.length>140 ||
      !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) continue;
    const distance=Math.round(pointDistanceMeters(lat,lng,pos.lat,pos.lon));
    if(distance>850) continue;
    const id=e.type+"/"+e.id;
    distinct.set(id,{id,name,category,distanceMeters:distance,latitude:pos.lat,longitude:pos.lon});
  }
  const groups: NearbyCategory[]=["transport","groceries","pharmacy","health"];
  return groups.flatMap(cat=>
    [...distinct.values()].filter(x=>x.category===cat)
      .sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,4));
}
