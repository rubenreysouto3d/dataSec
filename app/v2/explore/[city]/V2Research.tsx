"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AtlasMap from "@/app/lab/[city]/AtlasMap";
import type {
  CityActivityContext,
  CityBoundary,
  CityHarmTrendSummary,
  CityMapMetric,
  CitySafetySignal,
  CitySlug,
  Neighbourhood,
} from "@/lib/data";
import { areaDisplayName } from "@/lib/data";
import {
  createPlaceEvidenceContext,
  placeEvidenceExplanation,
  placeEvidenceLabel,
  placeEvidenceSource,
  type PlacePurpose,
} from "@/lib/place-evidence";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { MAP_COLOR_BANDS } from "@/lib/map-filters";
import { bandNumber } from "@/lib/map-view";
import { readSaved, toggleSaved } from "@/lib/v2-saved";
import type { NearbyCategory, NearbyPlace } from "@/lib/nearby-places";

type PointSelection = { latitude:number; longitude:number; label:string };
type Props = {
  city: CitySlug;
  areas: Neighbourhood[];
  metrics: CityMapMetric[];
  signals: CitySafetySignal[];
  activityContexts: CityActivityContext[];
  harmTrends: CityHarmTrendSummary | null;
  initialId: string | null;
  initialPurpose: PlacePurpose;
  initialPoint?: PointSelection | null;
};
type MapLayer = "incidents" | "trend" | "activity" | "night";
type StreetSignal="theft"|"drugs"|"disorder"|"violence";
type StreetHotspot = {
  id:string;latitude:number;longitude:number;street:string;total:number;
  primary:StreetSignal;primaryLabel:string;
  concentration:"low"|"medium"|"high";months:number;repeated:boolean;
  signals:Record<StreetSignal,number>;
  distanceMeters:number;
  locationKind:"street-reference"|"anonymised-reference";
  localRank:number;
};
type StreetContextResponse = {
  availability:"street"|"area-only"|"unsupported";
  city?:"madrid"|"london";
  areaId?:string;
  areaName?:string;
  latestMonth?:string;
  months?:string[];
  locationPrecision?:string;
  note?:string;
  hotspots:StreetHotspot[];
};
type NearbyResponse = {
  places: NearbyPlace[];
  attribution: string;
  completeness: string;
  distance: string;
};

const nearbyLabels: Record<NearbyCategory,string> = {
  transport:"Transporte",
  groceries:"Compra diaria",
  pharmacy:"Farmacias",
  health:"Salud",
  education:"Educación",
  green:"Parques",
};
const relativeLabels = [
  "Entre los registros más bajos",
  "Por debajo del tramo central",
  "En el tramo central",
  "Por encima del tramo central",
  "Entre los registros más altos",
];

function cityLabel(city:CitySlug){return city==="madrid"?"Madrid":"Londres";}
function normalize(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function fmt(value:number|null){
  return value===null||!Number.isFinite(value)?"—":new Intl.NumberFormat("es-ES",{maximumFractionDigits:1}).format(value);
}
function percentileByArea(items:Array<{areaId:string;value:number|null}>){
  const valid=items.filter((item):item is {areaId:string;value:number}=>item.value!==null&&Number.isFinite(item.value))
    .sort((a,b)=>a.value-b.value);
  const denominator=Math.max(valid.length-1,1);
  return new Map(valid.map((item,index)=>[item.areaId,index/denominator]));
}

export default function V2Research({
  city,areas,metrics,signals,activityContexts,harmTrends,initialId,initialPurpose,initialPoint=null,
}:Props){
  const router=useRouter();
  const [purpose,setPurpose]=useState<PlacePurpose>(initialPurpose);
  const [layer,setLayer]=useState<MapLayer>("incidents");
  const [selectedId,setSelectedId]=useState<string|null>(initialId);
  const [selectedPoint,setSelectedPoint]=useState<PointSelection|null>(initialPoint);
  const [query,setQuery]=useState("");
  const [focused,setFocused]=useState(false);
  const [candidate,setCandidate]=useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);
  const [geoLoading,setGeoLoading]=useState(false);
  const [geoError,setGeoError]=useState("");
  const [mapBoundaries,setMapBoundaries]=useState<CityBoundary[]|null>(null);
  const [mapError,setMapError]=useState(false);
  const [nearby,setNearby]=useState<NearbyResponse|null>(null);
  const [nearbyState,setNearbyState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [streetContext,setStreetContext]=useState<StreetContextResponse|null>(null);
  const [streetState,setStreetState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [showStreet,setShowStreet]=useState(true);
  const [streetFilter,setStreetFilter]=useState<"all"|StreetSignal>("all");
  const [locating,setLocating]=useState(false);
  const [saved,setSaved]=useState(false);
  const [shareStatus,setShareStatus]=useState("");

  const evidenceContext=useMemo(()=>createPlaceEvidenceContext(city,metrics,signals),[city,metrics,signals]);
  const areaById=useMemo(()=>new Map(areas.map(a=>[a.id,a])),[areas]);
  const metricByArea=useMemo(()=>new Map(metrics.map(metric=>[metric.areaId,metric])),[metrics]);
  const activityByArea=useMemo(()=>new Map(activityContexts.map(item=>[item.areaId,item])),[activityContexts]);
  const trendByArea=useMemo(()=>new Map((harmTrends?.areas??[]).map(item=>[item.areaId,item])),[harmTrends]);
  const signalByArea=useMemo(()=>new Map(signals.map(item=>[item.areaId,item])),[signals]);
  const activityPercentiles=useMemo(()=>percentileByArea(areas.map(area=>{
    const activity=activityByArea.get(area.id);
    const metric=metricByArea.get(area.id);
    const density=activity&&metric&&metric.areaKm2>0?activity.openHostelry/metric.areaKm2:null;
    return {areaId:area.id,value:density};
  })),[areas,activityByArea,metricByArea]);

  const selected=selectedId?areaById.get(selectedId)||null:null;
  const evidence=selected?evidenceContext.read(selected.id,purpose):null;
  const relative=evidence?bandNumber(evidence.percentile):null;
  const selectedMetric=selected?metricByArea.get(selected.id)||null:null;
  const selectedActivity=selected?activityByArea.get(selected.id)||null:null;
  const selectedTrend=selected?trendByArea.get(selected.id)||null:null;
  const selectedSignal=selected?signalByArea.get(selected.id)||null:null;
  const selectedActivityDensity=selectedActivity&&selectedMetric&&selectedMetric.areaKm2>0
    ?selectedActivity.openHostelry/selectedMetric.areaKm2:null;
  const selectedActivityBand=selected?bandNumber(activityPercentiles.get(selected.id)??null):null;
  const indicator=placeEvidenceLabel(city,purpose,evidenceContext.hasCityHarmSeries,"es");
  const source=placeEvidenceSource(city,"es");
  const mapValues=useMemo(()=>{
    if(layer==="activity")return new Map(areas.map(area=>[area.id,activityPercentiles.get(area.id)??null]));
    if(layer==="trend")return new Map(areas.map(area=>{
      const delta=trendByArea.get(area.id)?.percentChange;
      const normalized=delta===null||delta===undefined||!Number.isFinite(delta)?null:Math.max(0,Math.min(1,(delta+50)/100));
      return [area.id,normalized] as const;
    }));
    if(layer==="night")return new Map(areas.map(area=>[area.id,signalByArea.get(area.id)?.districtConcernPercentile??null]));
    return new Map(areas.map(area=>[area.id,evidenceContext.read(area.id,purpose).percentile]));
  },[areas,evidenceContext,purpose,layer,activityPercentiles,trendByArea,signalByArea]);

  const suggestions=useMemo(()=>{
    const text=normalize(query);
    if(text.length<2)return [];
    return areas.filter(a=>normalize(areaDisplayName(a)).includes(text))
      .sort((a,b)=>Number(!normalize(a.name).startsWith(text))-Number(!normalize(b.name).startsWith(text)))
      .slice(0,6);
  },[areas,query]);

  useEffect(()=>{
    let cancelled=false;
    setMapError(false);
    fetch("/v2/api/boundaries/"+city)
      .then(async response=>{
        if(!response.ok)throw new Error("map unavailable");
        const value:unknown=await response.json();
        if(!Array.isArray(value))throw new Error("invalid map");
        if(!cancelled)setMapBoundaries(value as CityBoundary[]);
      })
      .catch(()=>{if(!cancelled)setMapError(true);});
    return()=>{cancelled=true;};
  },[city]);

  useEffect(()=>{
    if(!selectedPoint){
      setNearby(null);setNearbyState("idle");return;
    }
    let cancelled=false;
    setNearbyState("loading");setNearby(null);
    const params=new URLSearchParams({
      lat:String(selectedPoint.latitude),
      lng:String(selectedPoint.longitude),
    });
    fetch("/v2/api/nearby?"+params.toString())
      .then(async response=>{
        if(!response.ok)throw new Error("nearby unavailable");
        const value=(await response.json()) as NearbyResponse;
        if(!Array.isArray(value.places))throw new Error("invalid nearby");
        if(!cancelled){setNearby(value);setNearbyState("ready");}
      })
      .catch(()=>{if(!cancelled)setNearbyState("error");});
    return()=>{cancelled=true;};
  },[selectedPoint]);

  useEffect(()=>{
    if(!selectedPoint){setStreetContext(null);setStreetState("idle");return;}
    let cancelled=false;
    setStreetState("loading");setStreetContext(null);
    const params=new URLSearchParams({
      lat:String(selectedPoint.latitude),
      lng:String(selectedPoint.longitude),
    });
    fetch("/v2/api/street-context?"+params.toString())
      .then(async response=>{
        if(!response.ok&&response.status!==404)throw new Error("street context unavailable");
        const value=(await response.json()) as StreetContextResponse;
        if(cancelled)return;
        if(value.city&&value.city!==city){
          const nextParams=new URLSearchParams({
            view:purpose,
            lat:String(selectedPoint.latitude),
            lng:String(selectedPoint.longitude),
            place:selectedPoint.label,
          });
          router.push("/v2/explore/"+value.city+"?"+nextParams.toString());
          return;
        }
        if(value.areaId&&areaById.has(value.areaId))setSelectedId(value.areaId);
        setStreetContext(value);setStreetState("ready");
      })
      .catch(()=>{if(!cancelled)setStreetState("error");});
    return()=>{cancelled=true;};
  },[selectedPoint,city,purpose,router,areaById]);

  useEffect(()=>{
    const next=new URL(window.location.href);
    next.searchParams.set("view",purpose);
    if(selectedId)next.searchParams.set("area",selectedId);else next.searchParams.delete("area");
    if(selectedPoint){
      next.searchParams.set("lat",selectedPoint.latitude.toFixed(6));
      next.searchParams.set("lng",selectedPoint.longitude.toFixed(6));
      next.searchParams.set("place",selectedPoint.label.slice(0,170));
    }else{
      next.searchParams.delete("lat");next.searchParams.delete("lng");next.searchParams.delete("place");
    }
    window.history.replaceState(window.history.state,"",next.pathname+next.search);
    const key=selectedPoint
      ?"point:"+selectedPoint.latitude.toFixed(5)+":"+selectedPoint.longitude.toFixed(5)
      :selectedId;
    setSaved(Boolean(key&&readSaved().some(x=>x.id===key&&x.purpose===purpose)));
    setShareStatus("");
  },[purpose,selectedId,selectedPoint]);

  function useCurrentLocation(){
    if(locating)return;
    if(typeof navigator==="undefined"||!navigator.geolocation){
      setGeoError("Este navegador no permite obtener la ubicación.");
      return;
    }
    setLocating(true);setGeoError("");
    navigator.geolocation.getCurrentPosition(
      position=>{
        const point={
          latitude:position.coords.latitude,
          longitude:position.coords.longitude,
          label:"Tu ubicación aproximada",
        };
        setSelectedPoint(point);setQuery("Tu ubicación");setFocused(false);setCandidate(null);
        setLocating(false);setShowStreet(true);
      },
      ()=>{
        setGeoError("No hemos podido usar tu ubicación. Puedes buscar una calle o lugar manualmente.");
        setLocating(false);
      },
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000},
    );
  }

  function selectArea(id:string){
    setSelectedId(id);setSelectedPoint(null);setQuery("");setFocused(false);
    setCandidate(null);setGeoError("");
  }

  async function lookupAddress(){
    if(query.trim().length<4||geoLoading)return;
    setGeoLoading(true);setGeoError("");setCandidate(null);
    try{
      const matched=await resolvePlaceToArea(query.trim());
      if(matched)setCandidate(matched);
      else setGeoError("No encontramos ese lugar dentro de la cobertura actual.");
    }catch{
      setGeoError("La búsqueda de lugares no está disponible ahora.");
    }finally{
      setGeoLoading(false);
    }
  }

  function openCandidate(){
    if(!candidate)return;
    const point={latitude:candidate.latitude,longitude:candidate.longitude,label:candidate.matchedPlace};
    if(candidate.citySlug!==city){
      const params=new URLSearchParams({
        view:purpose,area:candidate.id,lat:String(point.latitude),lng:String(point.longitude),place:point.label,
      });
      router.push("/v2/explore/"+candidate.citySlug+"?"+params.toString());
      return;
    }
    setSelectedId(candidate.id);setSelectedPoint(point);setQuery(candidate.matchedPlace);
    setFocused(false);setCandidate(null);
  }

  function saveCurrent(){
    if(!selected)return;
    const item=selectedPoint?{
      id:"point:"+selectedPoint.latitude.toFixed(5)+":"+selectedPoint.longitude.toFixed(5),
      areaId:selected.id,name:selectedPoint.label,city,purpose,
      latitude:selectedPoint.latitude,longitude:selectedPoint.longitude,
    }:{
      id:selected.id,name:selected.name,city,purpose,
    };
    const next=toggleSaved(item);
    setSaved(next.some(x=>x.id===item.id&&x.purpose===purpose));
  }

  async function shareCurrent(){
    try{
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Enlace copiado");
    }catch{
      setShareStatus("Copia la dirección del navegador.");
    }
  }

  const nearbyGroups=useMemo(()=>{
    if(!nearby)return [];
    const allowed:NearbyCategory[]=purpose==="resident"
      ?["transport","groceries","pharmacy","health","education","green"]
      :["transport","groceries","pharmacy","health"];
    return allowed.map(category=>({
      category,
      items:nearby.places.filter(place=>place.category===category).slice(0,3),
    }));
  },[nearby,purpose]);

  const visibleStreetHotspots=useMemo(()=>{
    const source=streetContext?.hotspots??[];
    if(streetFilter==="all")return source;
    return source.filter(item=>item.signals[streetFilter]>0);
  },[streetContext,streetFilter]);

  const nearbyHotspots=useMemo(()=>[...visibleStreetHotspots]
    .sort((a,b)=>{
      const level={high:0,medium:1,low:2};
      return level[a.concentration]-level[b.concentration]||a.distanceMeters-b.distanceMeters||b.total-a.total;
    }),[visibleStreetHotspots]);

  const streetAdvice=useMemo(()=>{
    const source=(streetContext?.hotspots??[]).filter(item=>item.repeated&&item.distanceMeters<=700);
    const totals:Record<StreetSignal,number>={theft:0,drugs:0,disorder:0,violence:0};
    for(const item of source){
      for(const key of Object.keys(totals) as StreetSignal[])totals[key]+=item.signals[key];
    }
    const notes:string[]=[];
    if(totals.theft>=15)notes.push("Presta especial atención a móvil, cartera y bolso.");
    if(totals.violence>=15)notes.push("Hay concentración repetida de violencia registrada en el entorno.");
    if(totals.disorder>=15)notes.push("Hay focos repetidos de desorden o conducta antisocial.");
    if(totals.drugs>=8)notes.push("Aparece actividad de drogas registrada de forma repetida.");
    return notes.slice(0,3);
  },[streetContext]);

  const layerCopy = layer==="trend"
    ? {title:"Cambio reciente",detail:"bajando → subiendo en los últimos 6 meses"}
    : layer==="activity"
      ? {title:"Actividad urbana",detail:"menos → más hostelería por km²"}
      : layer==="night"
        ? {title:"Percepción nocturna",detail:"mejor → peor percepción del distrito"}
        : {title:indicator,detail:"menos → más registros relativos dentro de "+cityLabel(city)};

  const risingAreas=useMemo(()=>[...(harmTrends?.areas??[])]
    .filter(item=>item.percentChange!==null&&Number.isFinite(item.percentChange))
    .sort((a,b)=>(b.percentChange??0)-(a.percentChange??0)).slice(0,3),[harmTrends]);
  const fallingAreas=useMemo(()=>[...(harmTrends?.areas??[])]
    .filter(item=>item.percentChange!==null&&Number.isFinite(item.percentChange))
    .sort((a,b)=>(a.percentChange??0)-(b.percentChange??0)).slice(0,3),[harmTrends]);
  const activeAreas=useMemo(()=>areas.map(area=>{
    const activity=activityByArea.get(area.id);
    const metric=metricByArea.get(area.id);
    const density=activity&&metric&&metric.areaKm2>0?activity.openHostelry/metric.areaKm2:null;
    return {areaId:area.id,density};
  }).filter((item):item is {areaId:string;density:number}=>item.density!==null&&Number.isFinite(item.density))
    .sort((a,b)=>b.density-a.density).slice(0,3),[areas,activityByArea,metricByArea]);

  const zoneProfile = selected ? [
    {
      label:"REGISTROS",
      value:evidence?.available&&relative?relativeLabels[relative-1]:"Sin lectura comparable",
      detail:evidence?.period||"sin período",
    },
    {
      label:"TENDENCIA 6M",
      value:selectedTrend?.percentChange===null||selectedTrend?.percentChange===undefined
        ?"Sin tendencia"
        : selectedTrend.percentChange>20
          ?"Subiendo"
          : selectedTrend.percentChange<-20
            ?"Bajando"
            :"Estable",
      detail:selectedTrend?.percentChange===null||selectedTrend?.percentChange===undefined
        ?"sin serie suficiente"
        :(selectedTrend.percentChange>0?"+":"")+fmt(selectedTrend.percentChange)+"%",
    },
    {
      label:"ACTIVIDAD",
      value:selectedActivityBand===null?"Sin lectura"
        :selectedActivityBand>=4?"Alta"
        :selectedActivityBand<=2?"Baja":"Intermedia",
      detail:selectedActivityDensity===null?"sin contexto de hostelería":fmt(selectedActivityDensity)+" locales/km²",
    },
    ...(selectedSignal?.districtNightSafety!==null&&selectedSignal?.districtNightSafety!==undefined?[{
      label:"NOCHE · DISTRITO",
      value:selectedSignal.districtNightSafety>=7?"Percepción favorable"
        :selectedSignal.districtNightSafety<=5.5?"Percepción baja":"Percepción intermedia",
      detail:fmt(selectedSignal.districtNightSafety)+"/10 · "+(selectedSignal.districtName||"distrito"),
    }]:[]),
  ] : [];

  return <main className="atlas-app">
    <section className="atlas-app-map" aria-label={"Mapa de "+cityLabel(city)}>
      {mapBoundaries?<AtlasMap
        city={city}
        boundaries={mapBoundaries}
        areas={areas}
        values={mapValues}
        selectedId={selectedId}
        selectedPoint={selectedPoint}
        hotspots={showStreet?visibleStreetHotspots:[]}
        onSelect={selectArea}
        locale="es"
      />:<div className="atlas-app-map-loading" role="status">
        <strong>{mapError?"El mapa no está disponible.":"Cargando "+cityLabel(city)+"…"}</strong>
        {mapError?<p>La búsqueda y los datos siguen disponibles.</p>:null}
      </div>}

      <div className="atlas-app-toolbar">
        <Link className="atlas-app-brand" href="/v2" aria-label="DataSec">data<span>Sec</span></Link>
        <div className="atlas-city-switch" aria-label="Ciudad">
          <Link className={city==="madrid"?"active":""} href={"/v2/explore/madrid?view="+purpose}>Madrid</Link>
          <Link className={city==="london"?"active":""} href={"/v2/explore/london?view="+purpose}>Londres</Link>
        </div>
        <div className="atlas-purpose-switch" role="group" aria-label="Contexto">
          <button type="button" className={purpose==="visitor"?"active":""} onClick={()=>setPurpose("visitor")}>Viaje</button>
          <button type="button" className={purpose==="resident"?"active":""} onClick={()=>setPurpose("resident")}>Vivir</button>
        </div>
        <button type="button" className="atlas-locate" onClick={useCurrentLocation} disabled={locating}>
          {locating?"Localizando…":"◎ Mi ubicación"}
        </button>
        <Link className="atlas-saved-link" href="/v2/saved">Guardados</Link>
      </div>

      <div className="atlas-search">
        <div className="atlas-search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={query}
            placeholder={"Buscar dirección, hotel o barrio en "+cityLabel(city)}
            aria-label="Buscar lugar"
            onFocus={()=>setFocused(true)}
            onChange={e=>{setQuery(e.target.value);setFocused(true);setCandidate(null);setGeoError("");}}
            onKeyDown={e=>{
              if(e.key==="Escape")setFocused(false);
              if(e.key==="Enter"){
                if(suggestions[0]&&normalize(suggestions[0].name)===normalize(query))selectArea(suggestions[0].id);
                else void lookupAddress();
              }
            }}/>
          {query?<button type="button" aria-label="Limpiar búsqueda" onClick={()=>{
            setQuery("");setCandidate(null);setGeoError("");setFocused(false);
          }}>×</button>:null}
        </div>
        {focused&&query.trim().length>=2?<div className="atlas-search-results">
          {suggestions.map(area=><button type="button" key={area.id} onClick={()=>selectArea(area.id)}>
            <strong>{area.name}</strong><span>{area.parentName||cityLabel(city)}</span>
          </button>)}
          <button type="button" className="atlas-search-exact" disabled={geoLoading} onClick={()=>void lookupAddress()}>
            <strong>{geoLoading?"Buscando…":"Buscar lugar exacto"}</strong>
            <span>Dirección, hotel o punto concreto</span>
          </button>
          {candidate?<div className="atlas-search-candidate">
            <small>LUGAR ENCONTRADO</small><strong>{candidate.matchedPlace}</strong>
            <button type="button" onClick={openCandidate}>Ver este punto en el mapa →</button>
          </div>:null}
          {geoError?<p className="atlas-search-error" role="alert">{geoError}</p>:null}
        </div>:null}
      </div>

      <div className="atlas-layer">
        <span>CAPAS DEL MAPA</span>
        <div className="atlas-layer-buttons" role="group" aria-label="Capas de información">
          <button type="button" className={layer==="incidents"?"active":""} onClick={()=>setLayer("incidents")}>Registros</button>
          <button type="button" className={layer==="trend"?"active":""} onClick={()=>setLayer("trend")}>Cambio</button>
          <button type="button" className={layer==="activity"?"active":""} onClick={()=>setLayer("activity")}>Actividad</button>
          {city==="madrid"?<button type="button" className={layer==="night"?"active":""} onClick={()=>setLayer("night")}>Noche</button>:null}
        </div>
        {streetContext?.availability==="street"?<button type="button" className={"atlas-street-toggle "+(showStreet?"active":"")} onClick={()=>setShowStreet(value=>!value)}>
          {showStreet?"● Focos de calle visibles":"○ Mostrar focos de calle"}
        </button>:null}
        <strong>{layerCopy.title}</strong>
        <div className="atlas-layer-scale" aria-label="Escala relativa">
          {MAP_COLOR_BANDS.map(band=><i key={band.max} style={{background:band.color}}/>)}
        </div>
        <small>{layerCopy.detail}</small>
      </div>
    </section>

    <aside className={"atlas-drawer "+(selected?"has-selection":"")} aria-live="polite">
      {!selected?<div className="atlas-empty atlas-city-pulse">
        <span className="atlas-kicker">DATASEC / {cityLabel(city).toUpperCase()} / AHORA</span>
        <h1>Qué está cambiando.</h1>
        <p>Empieza por una señal de ciudad, busca un sitio concreto o abre el mapa desde donde estás. Ninguna lista equivale a “mejor” o “peor” barrio.</p>
        <button type="button" className="atlas-here-cta" onClick={useCurrentLocation} disabled={locating}>
          {locating?"Localizando…":"◎ Ver qué tengo alrededor ahora"}
        </button>
        {geoError?<p className="atlas-search-error" role="alert">{geoError}</p>:null}

        {risingAreas.length?<section className="atlas-pulse-group">
          <div><span>SUBIDAS RECIENTES</span><small>últimos 3 meses vs. 3 anteriores</small></div>
          {risingAreas.map(item=><button type="button" key={item.areaId} onClick={()=>selectArea(item.areaId)}>
            <strong>{areaById.get(item.areaId)?.name||item.areaId}</strong>
            <b>{item.percentChange!==null?(item.percentChange>0?"+":"")+fmt(item.percentChange)+"%":"—"}</b>
          </button>)}
        </section>:null}

        {fallingAreas.length?<section className="atlas-pulse-group">
          <div><span>BAJADAS RECIENTES</span><small>misma señal y ventana</small></div>
          {fallingAreas.map(item=><button type="button" key={item.areaId} onClick={()=>selectArea(item.areaId)}>
            <strong>{areaById.get(item.areaId)?.name||item.areaId}</strong>
            <b>{item.percentChange!==null?fmt(item.percentChange)+"%":"—"}</b>
          </button>)}
        </section>:null}

        {activeAreas.length?<section className="atlas-pulse-group">
          <div><span>MÁS ACTIVIDAD</span><small>hostelería abierta por km²</small></div>
          {activeAreas.map(item=><button type="button" key={item.areaId} onClick={()=>selectArea(item.areaId)}>
            <strong>{areaById.get(item.areaId)?.name||item.areaId}</strong>
            <b>{fmt(item.density)}/km²</b>
          </button>)}
        </section>:null}

        <div className="atlas-empty-bottom">
          <Link href="/v2/guide">Datos y límites →</Link>
          <Link href="/v2/cities">Cobertura →</Link>
        </div>
      </div>:<div className="atlas-place">
        <header className="atlas-place-head">
          <div>
            <span className="atlas-kicker">{selectedPoint?"PUNTO CONCRETO":"ZONA"} · {cityLabel(city).toUpperCase()}</span>
            <h1>{selectedPoint?.label||selected.name}</h1>
            {selectedPoint?<p>{selected.name}{selected.parentName?" · "+selected.parentName:""}</p>
              :selected.parentName?<p>{selected.parentName}</p>:null}
          </div>
          <div className="atlas-place-actions">
            <button type="button" className={saved?"active":""} onClick={saveCurrent}>{saved?"✓":"＋"}</button>
            <button type="button" onClick={()=>void shareCurrent()}>↗</button>
          </div>
        </header>
        {shareStatus?<small className="atlas-share-status">{shareStatus}</small>:null}

        <section className="atlas-reality">
          <div className="atlas-section-title">
            <div><span>LECTURA DE ZONA</span><h2>Qué define este sitio ahora</h2></div>
          </div>
          <div className="atlas-reality-grid">
            {zoneProfile.map(item=><div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>)}
          </div>
          <details>
            <summary>Fuentes y límites</summary>
            <p>{source.note}</p>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
            {harmTrends?<p>La tendencia compara los tres meses más recientes con los tres anteriores usando la misma selección de categorías.</p>:null}
            {selectedActivity?<p>La actividad usa establecimientos abiertos/hostelería del contexto municipal disponible; no describe comportamiento de personas.</p>:null}
          </details>
        </section>

        {selectedPoint?<section className="atlas-street-context">
          <div className="atlas-section-title">
            <div><span>EN LA CALLE</span><h2>Focos cercanos</h2></div>
            {streetState==="loading"?<small>Consultando…</small>:null}
          </div>
          {streetState==="error"?<p className="atlas-inline-error">No se ha podido consultar la capa de calle ahora.</p>:null}
          {streetState==="ready"&&streetContext?.availability==="area-only"?<>
            <div className="atlas-street-unavailable">
              <strong>Esta ciudad no publica precisión de calle suficiente.</strong>
              <p>{streetContext.note||"La lectura disponible llega a la zona administrativa."}</p>
            </div>
          </>:null}
          {streetState==="ready"&&streetContext?.availability==="street"?<>
            {streetAdvice.length?<div className="atlas-street-advice">
              <span>QUÉ MERECE ATENCIÓN AQUÍ</span>
              {streetAdvice.map(note=><strong key={note}>{note}</strong>)}
            </div>:null}
            <div className="atlas-street-filters" role="group" aria-label="Filtrar focos cercanos">
              <button type="button" className={streetFilter==="all"?"active":""} onClick={()=>setStreetFilter("all")}>Todo</button>
              <button type="button" className={streetFilter==="theft"?"active":""} onClick={()=>setStreetFilter("theft")}><i data-kind="theft"/>Hurtos</button>
              <button type="button" className={streetFilter==="drugs"?"active":""} onClick={()=>setStreetFilter("drugs")}><i data-kind="drugs"/>Drogas</button>
              <button type="button" className={streetFilter==="disorder"?"active":""} onClick={()=>setStreetFilter("disorder")}><i data-kind="disorder"/>Desorden</button>
              <button type="button" className={streetFilter==="violence"?"active":""} onClick={()=>setStreetFilter("violence")}><i data-kind="violence"/>Violencia</button>
            </div>
            {nearbyHotspots.length?<div className="atlas-hotspot-list">
              {nearbyHotspots.slice(0,10).map(item=><div key={item.id} className={"atlas-hotspot "+item.concentration}>
                <i data-kind={item.primary}/>
                <div><strong>{item.locationKind==="anonymised-reference"?"Referencia anonimizada: ":"En torno a "}{item.street}</strong>
                  <span>{item.primaryLabel}{item.repeated?" · repetido en varios meses":""}</span></div>
                <b>~{item.distanceMeters} m</b>
              </div>)}
            </div>:<p className="atlas-inline-note">No aparecen concentraciones de esta categoría en la consulta cercana.</p>}
            <p className="atlas-street-note">
              Son ubicaciones policiales anonimizadas y aproximadas, no sucesos en tiempo real ni direcciones exactas. “Hurtos” incluye hurto a personas y robo; la fuente no separa específicamente carterismo.
              {streetContext.latestMonth?" Último mes: "+streetContext.latestMonth+".":""}
            </p>
          </>:null}
        </section>:null}

        {selectedPoint?<section className="atlas-nearby">
          <div className="atlas-section-title">
            <div><span>ALREDEDOR DEL PUNTO</span><h2>Lo que tienes cerca</h2></div>
            {nearbyState==="loading"?<small>Consultando…</small>:null}
          </div>
          {nearbyState==="error"?<p className="atlas-inline-error">No se ha podido consultar el entorno ahora.</p>:null}
          {nearbyState==="ready"?<div className="atlas-nearby-grid">
            {nearbyGroups.map(group=><section key={group.category}>
              <h3>{nearbyLabels[group.category]}</h3>
              {group.items.length?group.items.map(place=><a key={place.id}
                href={"https://www.openstreetmap.org/?mlat="+place.latitude+"&mlon="+place.longitude+"#map=17/"+place.latitude+"/"+place.longitude}
                target="_blank" rel="noreferrer">
                <span>{place.name}</span><b>~{place.distanceMeters} m</b>
              </a>):<p>Sin lugares identificados.</p>}
            </section>)}
          </div>:null}
          {nearby?.completeness?<small className="atlas-nearby-note">{nearby.completeness}</small>:null}
        </section>:<section className="atlas-point-cta">
          <span>¿TIENES UNA DIRECCIÓN AQUÍ?</span>
          <h2>Baja del barrio al punto real.</h2>
          <p>Busca arriba el hotel, portal o lugar concreto para añadir servicios cercanos y situarlo sobre el mapa.</p>
        </section>}

        <footer className="atlas-drawer-footer">
          <button type="button" onClick={()=>{
            setSelectedId(null);setSelectedPoint(null);setQuery("");setNearby(null);
          }}>← Volver a toda la ciudad</button>
          <Link href="/v2/guide">Cómo leer estos datos ↗</Link>
        </footer>
      </div>}
    </aside>
  </main>;
}
