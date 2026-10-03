"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { choiceHref, type ChoicePoint, type ChoiceSite, type ChoiceComparison } from "@/lib/address-choice";
import type { NearbyPlace, NearbyCategory } from "@/lib/nearby-places";

type Purpose="visitor"|"resident";
type Slot=0|1;
type Candidate=Awaited<ReturnType<typeof resolvePlaceToArea>>;
type NearbyResponse={places:NearbyPlace[];attribution:string;completeness:string;distance:string};
type Category={key:NearbyCategory;label:string};
const visitorCategories:Category[]=[
  {key:"transport",label:"Metro y tren"},{key:"groceries",label:"Alimentación"},
  {key:"pharmacy",label:"Farmacia"},{key:"health",label:"Atención sanitaria"},
];
const residentCategories:Category[]=[
  {key:"transport",label:"Metro y tren"},{key:"groceries",label:"Alimentación"},
  {key:"education",label:"Centros educativos"},{key:"green",label:"Parques y juegos"},
  {key:"pharmacy",label:"Farmacia"},{key:"health",label:"Atención sanitaria"},
];
function fmt(value:number|null){return value===null?"Sin dato":new Intl.NumberFormat("es-ES",{maximumFractionDigits:1}).format(value);}
function placeLink(p:NearbyPlace) {
  return "https://www.openstreetmap.org/?mlat="+p.latitude+"&mlon="+p.longitude+"#map=17/"+p.latitude+"/"+p.longitude;
}
function LocationInput({which,value,onPick}:{which:Slot;value:ChoicePoint|null;onPick:(p:ChoicePoint|null)=>void}) {
  const [query,setQuery]=useState(value?.label??"");
  const [candidate,setCandidate]=useState<Candidate>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{setQuery(value?.label??"");setCandidate(null);},[value?.label,value?.latitude,value?.longitude]);
  async function search(){
    if(query.trim().length<5||busy)return;
    setError("");setCandidate(null);setBusy(true);
    try {
      const match=await resolvePlaceToArea(query.trim());
      if(match)setCandidate(match);
      else setError("Sin coincidencia en Madrid o Londres. Escribe calle, número y ciudad.");
    } catch {setError("El servicio de direcciones no responde ahora.");}
    finally{setBusy(false);}
  }
  return <section className="choice-locator" aria-label={"Ubicación "+(which===0?"A":"B")}>
    <div className="choice-slot-head"><span>{which===0?"A":"B"}</span>
      <strong>{which===0?"Primera ubicación":"Segunda ubicación"}</strong></div>
    {value?<div className="choice-confirmed">
      <strong>{value.label}</strong>
      <div><span>Ubicación confirmada</span>
        <button type="button" onClick={()=>{onPick(null);setCandidate(null);setQuery("");}}>Cambiar ↗</button></div>
    </div>:<>
      <label htmlFor={"choice-input-"+which}>Dirección concreta con ciudad</label>
      <div className="choice-entry">
        <input id={"choice-input-"+which} type="search" value={query}
          onChange={e=>{setQuery(e.target.value);setCandidate(null);setError("");}}
          onKeyDown={e=>{if(e.key==="Enter")void search();}}
          placeholder={which===0?"Ej.: Puerta del Sol 1, Madrid":"Ej.: Calle Fuencarral 30, Madrid"}/>
        <button type="button" disabled={busy||query.trim().length<5} onClick={search}>
          {busy?"Buscando…":"Buscar ↗"}</button>
      </div>
      {candidate&&<div className="choice-possible" role="status">
        <small>COMPRUEBA EL RESULTADO ANTES DE SEGUIR</small><strong>{candidate.matchedPlace}</strong>
        <p>{candidate.locationKind==="broad"
          ?"Parece una zona extensa, no una dirección precisa. Introduce una calle y número."
          :"Punto geocodificado. Podría corresponder al centro del inmueble y no a su entrada."}</p>
        {candidate.locationKind==="specific"&&<button type="button" onClick={()=>
          onPick({latitude:candidate.latitude,longitude:candidate.longitude,label:candidate.matchedPlace,view:"visitor"})
        }>Confirmar esta ubicación →</button>}
      </div>}
      {error&&<p role="alert" className="choice-error">{error}</p>}
      <p className="choice-provider">La búsqueda solo se realiza al pulsar Buscar y usa un geocodificador de prueba de OpenStreetMap.</p>
    </>}
  </section>;
}

export default function ChoiceClient({initialFirst,initialSecond,purpose,sites,comparison,error}:{
  initialFirst:ChoicePoint|null;initialSecond:ChoicePoint|null;purpose:Purpose;
  sites:[ChoiceSite,ChoiceSite]|null;comparison:ChoiceComparison|null;error:string;
}){
  const router=useRouter();
  const [view,setView]=useState<Purpose>(purpose);
  const [points,setPoints]=useState<[ChoicePoint|null,ChoicePoint|null]>([initialFirst,initialSecond]);
  const [nearby,setNearby]=useState<[NearbyResponse|null,NearbyResponse|null]>([null,null]);
  const [nearbyState,setNearbyState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [focus,setFocus]=useState<NearbyCategory>(purpose==="visitor"?"transport":"groceries");
  const sections=view==="visitor"?visitorCategories:residentCategories;
  function change(slot:Slot, point:ChoicePoint|null) {
    const next:[ChoicePoint|null,ChoicePoint|null]=[...points];
    next[slot]=point?{...point,view}:null;
    setPoints(next);setNearby([null,null]);setNearbyState("idle");
  }
  function changeView(next:Purpose) {
    setView(next);setFocus(next==="visitor"?"transport":"groceries");
    setNearby([null,null]);setNearbyState("idle");
    const old=[...points] as [ChoicePoint|null,ChoicePoint|null];
    router.push(choiceHref(old[0],old[1],next));
  }
  async function checkSurroundings(){
    if(!sites||nearbyState==="loading")return;
    setNearbyState("loading");
    try {
      const data=await Promise.all(sites.map(async site=>{
        const params=new URLSearchParams({lat:String(site.point.latitude),lng:String(site.point.longitude)});
        const result=await fetch("/v2/api/nearby?"+params.toString());
        if(!result.ok)throw new Error("Missing context");
        const body=(await result.json()) as NearbyResponse;
        if(!Array.isArray(body.places))throw new Error("Invalid context");
        return body;
      }));
      setNearby(data as [NearbyResponse,NearbyResponse]);setNearbyState("ready");
    } catch {
      setNearbyState("error");
    }
  }
  const availableComparable=comparison==="comparable";
  return <main className="choice-page dv2-container">
    <nav className="choice-breadcrumb"><Link href="/v2">Inicio</Link><span>/</span><strong>Compara dos ubicaciones</strong></nav>
    <div className="choice-header"><div><span>LA HERRAMIENTA / UNA DECISIÓN REAL</span>
      <h1>Dos direcciones.<br/><em>Una decisión mejor informada.</em></h1>
      <p>Comprueba lo que realmente cambia entre dos ubicaciones. Los registros policiales son
        información de su zona oficial; los servicios se consultan alrededor de cada punto.</p></div>
      <div className="choice-purpose" role="group" aria-label="Qué estás planeando">
        <button type="button" aria-pressed={view==="visitor"} className={view==="visitor"?"selected":""}
          onClick={()=>changeView("visitor")}>Viajar</button>
        <button type="button" aria-pressed={view==="resident"} className={view==="resident"?"selected":""}
          onClick={()=>changeView("resident")}>Vivir</button>
      </div>
    </div>
    <div className="choice-inputs">
      <LocationInput key={"a-"+(points[0]?.latitude??"none")} which={0} value={points[0]} onPick={p=>change(0,p)}/>
      <LocationInput key={"b-"+(points[1]?.latitude??"none")} which={1} value={points[1]} onPick={p=>change(1,p)}/>
    </div>
    <div className="choice-compare-action">
      <p>Se contrastarán los mismos indicadores cuando pertenezcan a la misma ciudad y período.</p>
      <button type="button" disabled={!points[0]||!points[1]}
        onClick={()=>router.push(choiceHref(points[0],points[1],view))}>Comparar estas ubicaciones →</button>
    </div>
    {error&&<div className="choice-error-panel" role="alert">{error}</div>}
    {!sites&&<div className="choice-empty">
      <span>QUÉ OBTENDRÁS</span><h2>Información que te ayuda a elegir.</h2>
      <div><p><b>1. Registros comparables</b><small>Una misma fuente, indicadores identificados y períodos explícitos. Nunca una nota inventada de seguridad.</small></p>
        <p><b>2. Tu entorno inmediato</b><small>Estaciones, tiendas y servicios cerca de cada punto, no de todo el barrio.</small></p>
        <p><b>3. Lo que ignoramos</b><small>Sin garantías sobre calles ni reputaciones convertidas en estadísticas.</small></p></div>
      <Link href={choiceHref(
        {latitude:40.4169,longitude:-3.7034,label:"Puerta del Sol, Madrid",view},
        {latitude:40.4270,longitude:-3.7019,label:"Glorieta de Bilbao, Madrid",view},view
      )}>Probar con dos puntos de Madrid →</Link>
    </div>}
    {sites&&<div className="choice-results" aria-live="polite">
      <div className="choice-result-intro"><span>RESULTADOS / {view==="visitor"?"TU VIAJE":"TU MUDANZA"}</span>
        <h2>Lo que sabemos de cada ubicación.</h2></div>
      <section className="choice-evidence" aria-labelledby="choice-evidence-title">
        <header><h3 id="choice-evidence-title">Registros disponibles</h3>
          <p>{comparison==="same-area"?"Los dos puntos pertenecen a la misma zona oficial. Las cifras no permiten distinguirlos.":
            comparison==="different-city"?"Las ciudades utilizan fuentes distintas: no corresponde comparar directamente sus valores.":
            comparison==="different-period"?"Las observaciones corresponden a períodos distintos: no ofrecemos una comparación numérica directa.":
            availableComparable?"Mismo indicador y período en la misma ciudad. La cifra no representa un riesgo personal.":
            "Faltan observaciones compatibles para comparar las dos zonas."}</p></header>
        <div className="choice-evidence-grid">{sites.map((site,i)=><article key={i}>
          <span>UBICACIÓN {i===0?"A":"B"}</span>
          <h4>{site.area.name}</h4>
          <p>{site.area.parentName||site.area.cityName} · {site.area.cityName}</p>
          <strong>{site.evidence.available?fmt(site.evidence.value):"Sin dato"}</strong>
          <small>{site.indicator}</small>
          <span className="choice-observed">{site.evidence.period||"Período no disponible"}</span>
          <a href={site.source.url} rel="noopener noreferrer" target="_blank">Fuente oficial ↗</a>
        </article>)}</div>
        <p className="choice-evidence-foot">
          {comparison==="same-area"?"Para distinguir estas dos direcciones, consulta sus servicios y conexiones inmediatas.":
            availableComparable?"Es una comparación de registros, no una recomendación de dónde alojarse o vivir.":
            "Lee cada dato por separado. Ninguna diferencia se interpreta como un indicador universal de seguridad."}
        </p>
      </section>
      <section className="choice-context" aria-labelledby="choice-context-title">
        <header><div><span>ALREDEDOR DE CADA DIRECCIÓN</span>
          <h3 id="choice-context-title">Ahora sí, ¿qué cambia entre las dos?</h3>
          <p>Observaciones reales de OpenStreetMap alrededor de cada punto. La cobertura es colaborativa e incompleta.</p></div>
          {nearbyState!=="ready"&&<button type="button" disabled={nearbyState==="loading"} onClick={checkSurroundings}>
            {nearbyState==="loading"?"Consultando ambos entornos…":
              nearbyState==="error"?"Reintentar consulta →":"Comparar el entorno inmediato ↗"}</button>}
        </header>
        {nearbyState==="error"&&<p role="alert" className="choice-error">No hay datos del entorno disponibles ahora. El resto de la comparación sigue siendo válido.</p>}
        {nearbyState==="ready"&&nearby[0]&&nearby[1]&&<>
          <div className="choice-filters" role="group" aria-label="Servicios que te interesan">
            {sections.map(s=><button key={s.key} type="button" aria-pressed={focus===s.key}
              className={focus===s.key?"selected":""} onClick={()=>setFocus(s.key)}>{s.label}</button>)}
          </div>
          <div className="choice-nearby-grid">{nearby.map((site,i)=>{
            const items=site!.places.filter(p=>p.category===focus);
            return <article key={i}><h4>UBICACIÓN {i===0?"A":"B"}</h4>
              <strong>{items.length?items[0].name:"Sin elementos identificados"}</strong>
              <span>{items.length?"~"+items[0].distanceMeters+" m en línea recta":"La ausencia no confirma que no haya servicios"}</span>
              {items.map(p=><a key={p.id} href={placeLink(p)} target="_blank" rel="noopener noreferrer">
                {p.name} <small>~{p.distanceMeters} m ↗</small></a>)}
            </article>;
          })}</div>
          <p className="choice-license">© OpenStreetMap contributors (ODbL). Distancias en línea recta,
            no recorridos reales. Los establecimientos cartografiados no representan necesariamente todos los existentes.</p>
        </>}
      </section>
      <section className="choice-no-guesses">
        <span>LO QUE NO SE PUEDE CONCLUIR</span><h3>Una dirección no hereda la reputación de un barrio.</h3>
        <p>Los registros municipales y policiales disponibles no acreditan qué calle debes evitar.
          Dos direcciones dentro del mismo barrio compartirán los mismos registros agregados aunque
          sus servicios y recorridos puedan ser diferentes. No existe aquí una calificación general
          de seguridad, ni de sus habitantes.</p>
        <div>{sites.map((s,i)=><Link key={i} href={"/v2/report?"+new URLSearchParams({
          lat:String(s.point.latitude),lng:String(s.point.longitude),
          place:s.point.label,view,
        })}>Abrir informe {i===0?"A":"B"} ↗</Link>)}</div>
      </section>
    </div>}
  </main>;
}
