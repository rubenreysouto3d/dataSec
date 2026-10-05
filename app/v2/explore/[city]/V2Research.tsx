"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  placeLensLabels,
  placeLensPurpose,
  type PlaceContext,
  type PlaceLens,
} from "@/lib/place-context-contract";

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
  initialLens: PlaceLens;
  initialPoint?: PointSelection | null;
  initialPlaceContext?: PlaceContext | null;
};
type MapLayer = "context" | "incidents" | "trend" | "activity" | "night";
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
  city,areas,metrics,signals,activityContexts,harmTrends,initialId,initialPurpose,initialLens,
  initialPoint=null,initialPlaceContext=null,
}:Props){
  const router=useRouter();
  const [lens,setLens]=useState<PlaceLens>(initialLens);
  const purpose=placeLensPurpose[lens];
  const [layer,setLayer]=useState<MapLayer>("context");
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
  const [placeContext,setPlaceContext]=useState<PlaceContext|null>(initialPlaceContext);
  const [contextState,setContextState]=useState<"idle"|"loading"|"ready"|"error">(
    initialPlaceContext?"ready":"idle"
  );
  const initialContextKey=useRef(initialPlaceContext&&initialPoint
    ?initialPoint.latitude.toFixed(6)+"|"+initialPoint.longitude.toFixed(6)+"|"+initialLens
    :null);
  const [showStreet,setShowStreet]=useState(true);
  const [streetFilter,setStreetFilter]=useState<"all"|StreetSignal>("all");
  const [locating,setLocating]=useState(false);
  const [saved,setSaved]=useState(false);
  const [shareStatus,setShareStatus]=useState("");
  void initialPurpose;

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
    if(layer==="context")return new Map(areas.map(area=>[area.id,null]));
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
    if(!selectedPoint){setPlaceContext(null);setContextState("idle");return;}
    const requestKey=selectedPoint.latitude.toFixed(6)+"|"+selectedPoint.longitude.toFixed(6)+"|"+lens;
    if(initialContextKey.current===requestKey){
      initialContextKey.current=null;
      return;
    }
    let cancelled=false;
    setContextState("loading");setPlaceContext(current=>
      current?.place.coordinate.latitude===selectedPoint.latitude&&
      current?.place.coordinate.longitude===selectedPoint.longitude?current:null
    );
    const params=new URLSearchParams({
      lat:String(selectedPoint.latitude),
      lng:String(selectedPoint.longitude),
      label:selectedPoint.label,
      lens,
    });
    fetch("/v2/api/place-context?"+params.toString())
      .then(async response=>{
        if(!response.ok)throw new Error("place context unavailable");
        const value=(await response.json()) as PlaceContext;
        if(cancelled)return;
        if(value.place.city!==city){
          const nextParams=new URLSearchParams({
            view:placeLensPurpose[lens],
            lens,
            lat:String(selectedPoint.latitude),
            lng:String(selectedPoint.longitude),
            place:selectedPoint.label,
          });
          router.push("/v2/explore/"+value.place.city+"?"+nextParams.toString());
          return;
        }
        if(areaById.has(value.place.area.id))setSelectedId(value.place.area.id);
        setPlaceContext(value);setContextState("ready");
      })
      .catch(()=>{if(!cancelled)setContextState("error");});
    return()=>{cancelled=true;};
  },[selectedPoint,city,lens,router,areaById]);

  useEffect(()=>{
    const next=new URL(window.location.href);
    next.searchParams.set("view",purpose);
    next.searchParams.set("lens",lens);
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
  },[purpose,lens,selectedId,selectedPoint]);

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

  const streetContext=placeContext?.evidence.street??null;
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

  const layerCopy = layer==="context"
    ? {title:"Mapa base",detail:"sin convertir una métrica en veredicto general"}
    : layer==="trend"
    ? {title:"Cambio reciente",detail:"bajando → subiendo en los últimos 6 meses"}
    : layer==="activity"
      ? {title:"Actividad urbana",detail:"menos → más hostelería por km²"}
      : layer==="night"
        ? {title:"Percepción nocturna",detail:"mejor → peor percepción del distrito"}
        : {title:indicator,detail:"menos → más registros relativos dentro de "+cityLabel(city)};

  const localStreetHotspots=useMemo(
    ()=>(streetContext?.hotspots??[]).filter(item=>item.distanceMeters<=700),
    [streetContext]
  );
  const streetSignalCounts=useMemo(()=>{
    const counts:Record<StreetSignal,number>={theft:0,drugs:0,disorder:0,violence:0};
    for(const item of localStreetHotspots){
      for(const key of Object.keys(counts) as StreetSignal[]){
        if(item.signals[key]>0)counts[key]+=1;
      }
    }
    return counts;
  },[localStreetHotspots]);
  const streetSignalMeta:Array<{key:StreetSignal;label:string}>=[
    {key:"theft",label:"Hurtos"},
    {key:"drugs",label:"Drogas"},
    {key:"disorder",label:"Desorden"},
    {key:"violence",label:"Violencia"},
  ];

  return <main className="atlas-app street-app">
    <section className="atlas-app-map street-map" aria-label={"Mapa de "+cityLabel(city)}>
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
        {mapError?<p>La búsqueda y la ficha siguen disponibles.</p>:null}
      </div>}

      <div className="street-topbar">
        <Link className="street-brand" href="/v2" aria-label="DataSec">data<span>Sec</span></Link>

        <div className="street-search">
          <div className="street-search-field">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={query}
              placeholder="Buscar calle, hotel o barrio"
              aria-label="Buscar calle, hotel o barrio"
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
          {focused&&query.trim().length>=2?<div className="street-search-results">
            {suggestions.map(area=><button type="button" key={area.id} onClick={()=>selectArea(area.id)}>
              <strong>{area.name}</strong><span>{area.parentName||cityLabel(city)}</span>
            </button>)}
            <button type="button" className="street-search-exact" disabled={geoLoading} onClick={()=>void lookupAddress()}>
              <strong>{geoLoading?"Buscando…":"Buscar este lugar exacto"}</strong>
              <span>Dirección, hotel o punto concreto</span>
            </button>
            {candidate?<div className="street-search-candidate">
              <small>LUGAR ENCONTRADO</small>
              <strong>{candidate.matchedPlace}</strong>
              <button type="button" onClick={openCandidate}>Abrir aquí →</button>
            </div>:null}
            {geoError?<p className="street-search-error" role="alert">{geoError}</p>:null}
          </div>:null}
        </div>

        <button type="button" className="street-locate" onClick={useCurrentLocation} disabled={locating}>
          <span aria-hidden="true">⌖</span><b>{locating?"Buscando…":"Estoy aquí"}</b>
        </button>

        <details className="street-city">
          <summary>{cityLabel(city)}</summary>
          <div>
            <Link className={city==="madrid"?"active":""} href={"/v2/explore/madrid?view="+purpose}>Madrid</Link>
            <Link className={city==="london"?"active":""} href={"/v2/explore/london?view="+purpose}>Londres</Link>
          </div>
        </details>
      </div>

      <details className="street-layer-menu">
        <summary>Mapa · {layer==="context"?"Base":layer==="incidents"?"Registros":layer==="trend"?"Cambio":layer==="activity"?"Actividad":"Noche"}</summary>
        <div className="street-layer-panel">
          <span>QUÉ QUIERES VER</span>
          <div>
            <button type="button" className={layer==="context"?"active":""} onClick={()=>setLayer("context")}>Base</button>
            <button type="button" className={layer==="incidents"?"active":""} onClick={()=>setLayer("incidents")}>Registros</button>
            <button type="button" className={layer==="trend"?"active":""} onClick={()=>setLayer("trend")}>Cambio</button>
            <button type="button" className={layer==="activity"?"active":""} onClick={()=>setLayer("activity")}>Actividad</button>
            {city==="madrid"?<button type="button" className={layer==="night"?"active":""} onClick={()=>setLayer("night")}>Noche</button>:null}
          </div>
          <strong>{layerCopy.title}</strong>
          <div className="street-layer-scale">
            {MAP_COLOR_BANDS.map(band=><i key={band.max} style={{background:band.color}}/>)}
          </div>
          <small>{layerCopy.detail}</small>
        </div>
      </details>
    </section>

    <aside className={"street-sheet "+(selected?"has-selection":"idle")} aria-live="polite">
      <div className="street-sheet-handle" aria-hidden="true"/>

      {!selected?<div className="street-idle">
        <span className="street-eyebrow">DATASEC · EN EL SITIO</span>
        <h1>¿Dónde estás?</h1>
        <p>Abre tu ubicación o busca arriba una calle, hotel o barrio. El mapa te enseña qué merece atención alrededor.</p>
        <button type="button" className="street-primary" onClick={useCurrentLocation} disabled={locating}>
          <span aria-hidden="true">⌖</span>{locating?"Buscando tu ubicación…":"Ver qué tengo alrededor"}
        </button>
        {geoError?<p className="street-inline-error" role="alert">{geoError}</p>:null}
        <div className="street-idle-foot">
          <span>{cityLabel(city)}</span>
          <Link href="/v2/guide">Cómo leer los datos</Link>
        </div>
      </div>:<div className="street-place">
        <header className="street-place-head">
          <div>
            <span className="street-eyebrow">{selectedPoint?"CERCA DE ESTE PUNTO":"ZONA"} · {cityLabel(city).toUpperCase()}</span>
            <h1>{selectedPoint?.label||selected.name}</h1>
            <p>{selectedPoint?selected.name+(selected.parentName?" · "+selected.parentName:""):selected.parentName||cityLabel(city)}</p>
          </div>
          <div className="street-place-actions">
            <button type="button" className={saved?"active":""} aria-label={saved?"Guardado":"Guardar"} onClick={saveCurrent}>{saved?"✓":"＋"}</button>
            <button type="button" aria-label="Compartir" onClick={()=>void shareCurrent()}>↗</button>
          </div>
        </header>
        {shareStatus?<small className="street-share-status">{shareStatus}</small>:null}

        <div className="place-lenses" role="group" aria-label="Situación">
          {(Object.keys(placeLensLabels) as PlaceLens[]).map(item=><button
            type="button"
            key={item}
            className={lens===item?"active":""}
            onClick={()=>setLens(item)}>
            {placeLensLabels[item]}
          </button>)}
        </div>

        {selectedPoint?<section className="place-context-read">
          <div className="place-context-read-head">
            <div>
              <span className="street-eyebrow">QUÉ IMPORTA · {placeLensLabels[lens].toUpperCase()}</span>
              <h2>{contextState==="loading"?"Leyendo este lugar…":contextState==="error"?"No puedo completar la lectura ahora":placeContext?.findings[0]?.statement||"Todavía no hay una conclusión principal defendible."}</h2>
            </div>
            {placeContext?<small>{placeContext.coverage.street==="available"?"calle + zona":"zona"} · {placeContext.place.area.name}</small>:null}
          </div>

          {contextState==="error"?<p className="street-inline-error">El lugar sigue seleccionado, pero una de las fuentes necesarias no ha respondido.</p>:null}

          {contextState==="ready"&&placeContext?<div className="place-findings">
            {placeContext.findings.map((finding,index)=><article className={"place-finding "+finding.importance} key={finding.id}>
              <div className="place-finding-index">{String(index+1).padStart(2,"0")}</div>
              <div className="place-finding-body">
                {index>0?<h3>{finding.statement}</h3>:null}
                {finding.implication?<p>{finding.implication}</p>:null}
                <footer>
                  <span>{finding.geography.label}</span>
                  <span>{finding.observedPeriod.start&&finding.observedPeriod.end
                    ?finding.observedPeriod.start===finding.observedPeriod.end
                      ?finding.observedPeriod.end
                      :finding.observedPeriod.start+" → "+finding.observedPeriod.end
                    :"sin período comparable"}</span>
                  <span>{finding.confidence.level==="strong"?"evidencia sólida":finding.confidence.level==="limited"?"evidencia limitada":"contexto"}</span>
                </footer>
              </div>
            </article>)}
          </div>:null}

          {streetContext?.availability==="street"?<details className="place-evidence-detail">
            <summary>Ver focos cercanos publicados</summary>
            <div className="street-signal-row" role="group" aria-label="Filtrar señales cercanas">
              {streetSignalMeta.map(item=><button type="button" key={item.key}
                className={streetFilter===item.key?"active":""}
                onClick={()=>setStreetFilter(streetFilter===item.key?"all":item.key)}>
                <i data-kind={item.key}/>
                <span>{item.label}</span>
                <b>{streetSignalCounts[item.key]||"—"}</b>
              </button>)}
            </div>
            <div className="street-hotspots">
              {nearbyHotspots.slice(0,5).map(item=><div key={item.id} className={"street-hotspot "+item.concentration}>
                <i data-kind={item.primary}/>
                <div>
                  <strong>{item.locationKind==="anonymised-reference"?"Ubicación aproximada":item.street}</strong>
                  <span>{item.primaryLabel}{item.repeated?" · repetido":""}</span>
                </div>
                <b>~{item.distanceMeters} m</b>
              </div>)}
            </div>
            <button type="button" className="street-map-toggle" onClick={()=>setShowStreet(value=>!value)}>
              {showStreet?"Ocultar puntos del mapa":"Mostrar puntos en el mapa"}
            </button>
            <small className="street-data-note">
              Puntos policiales aproximados y anonimizados; no son sucesos en tiempo real ni direcciones exactas.
            </small>
          </details>:null}

          {contextState==="ready"&&placeContext?<details className="place-evidence-detail">
            <summary>Qué sabemos y qué falta</summary>
            <div className="place-domain-list">
              {placeContext.domains.map(domain=><div key={domain.id}>
                <span className={"place-domain-status "+domain.status}>{domain.status==="observed"?"disponible":domain.status==="research"?"en integración":domain.status==="context"?"contexto":"no disponible"}</span>
                <strong>{domain.label}</strong>
                <p>{domain.summary}</p>
              </div>)}
            </div>
            {placeContext.coverage.limitations.length?<div className="place-limitations">
              {placeContext.coverage.limitations.map(item=><span key={item}>{item}</span>)}
            </div>:null}
          </details>:null}
        </section>:<section className="street-area-prompt">
          <strong>{selected.name}</strong>
          <p>Esto es una zona administrativa. Para obtener un contexto de lugar completo, busca una dirección o usa tu ubicación.</p>
          <button type="button" onClick={useCurrentLocation} disabled={locating}>⌖ Usar mi ubicación</button>
        </section>}

        {selectedPoint?<details className="street-more">
          <summary>Servicios cerca</summary>
          {nearbyState==="loading"?<p className="street-muted">Consultando el entorno…</p>:null}
          {nearbyState==="error"?<p className="street-inline-error">No se ha podido consultar el entorno ahora.</p>:null}
          {nearbyState==="ready"?<div className="street-nearby-grid">
            {nearbyGroups.map(group=><section key={group.category}>
              <h3>{nearbyLabels[group.category]}</h3>
              {group.items.length?group.items.map(place=><a key={place.id}
                href={"https://www.openstreetmap.org/?mlat="+place.latitude+"&mlon="+place.longitude+"#map=17/"+place.latitude+"/"+place.longitude}
                target="_blank" rel="noreferrer">
                <span>{place.name}</span><b>~{place.distanceMeters} m</b>
              </a>):<p>Sin lugares identificados.</p>}
            </section>)}
          </div>:null}
        </details>:null}

        <details className="street-more street-source">
          <summary>Fuente y límites</summary>
          <p>{source.note}</p>
          <a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>
        </details>

        <footer className="street-sheet-footer">
          <button type="button" onClick={()=>{
            setSelectedId(null);setSelectedPoint(null);setQuery("");setNearby(null);setPlaceContext(null);
          }}>Volver al mapa</button>
          <Link href="/v2/guide">Datos y límites</Link>
        </footer>
      </div>}
    </aside>
  </main>;
}
