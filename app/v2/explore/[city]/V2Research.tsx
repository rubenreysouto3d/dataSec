"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AtlasMap from "@/app/lab/[city]/AtlasMap";
import SourceLocationCaveat, { isMadridDispatchLocationCaveat } from "@/components/SourceLocationCaveat";
import { areaDisplayName, type CityBoundary, type CityMapMetric, type CitySafetySignal, type CitySlug, type Neighbourhood } from "@/lib/data";
import { createPlaceEvidenceContext, placeEvidenceLabel, placeEvidenceExplanation, placeEvidenceSource, type PlacePurpose } from "@/lib/place-evidence";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { locationReportHref } from "@/lib/location-report";
import { MAP_COLOR_BANDS } from "@/lib/map-filters";
import { bandNumber } from "@/lib/map-view";
import { readSaved, toggleSaved } from "@/lib/v2-saved";

type Tab = "overview" | "map" | "compare";
type Props = {
  city: CitySlug;
  areas: Neighbourhood[];
  metrics: CityMapMetric[];
  signals: CitySafetySignal[];
  initialId: string | null;
  initialPurpose: PlacePurpose;
};
function label(city: CitySlug) { return city === "madrid" ? "Madrid" : "Londres"; }
function fmt(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—"
    : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
const relativeLabels = [
  "Entre los valores registrados más bajos",
  "Por debajo de la zona media",
  "En torno a la zona media",
  "Por encima de la zona media",
  "Entre los valores registrados más altos",
];

export default function V2Research({city,areas,metrics,signals,initialId,initialPurpose}:Props) {
  const [purpose,setPurpose]=useState<PlacePurpose>(initialPurpose);
  const [selectedId,setSelectedId]=useState<string|null>(initialId);
  const [tab,setTab]=useState<Tab>("overview");
  const [query,setQuery]=useState("");
  const [focused,setFocused]=useState(false);
  const [candidate,setCandidate]=useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);
  const [geoLoading,setGeoLoading]=useState(false);
  const [geoError,setGeoError]=useState("");
  const [compareId,setCompareId]=useState<string|null>(null);
  const [compareQuery,setCompareQuery]=useState("");
  const [saved,setSaved]=useState(false);
  const [shareStatus,setShareStatus]=useState("");
  const [mapBoundaries,setMapBoundaries]=useState<CityBoundary[]|null>(null);
  const [mapLoading,setMapLoading]=useState(false);
  const [mapError,setMapError]=useState(false);

  const evidenceContext=useMemo(()=>createPlaceEvidenceContext(city,metrics,signals),[city,metrics,signals]);
  const areaById=useMemo(()=>new Map(areas.map(a=>[a.id,a])),[areas]);
  const metricMap=useMemo(()=>new Map(metrics.map(m=>[m.areaId,m])),[metrics]);
  const signalMap=useMemo(()=>new Map(signals.map(m=>[m.areaId,m])),[signals]);
  const selected=selectedId?areaById.get(selectedId)||null:null;
  const evidence=selected?evidenceContext.read(selected.id,purpose):null;
  const relative=evidence?bandNumber(evidence.percentile):null;
  const comparison=compareId?areaById.get(compareId)||null:null;
  const compareEvidence=comparison?evidenceContext.read(comparison.id,purpose):null;
  const source=placeEvidenceSource(city,"es");
  const indicator=placeEvidenceLabel(city,purpose,evidenceContext.hasCityHarmSeries,"es");
  const latest=metrics.reduce((current,m)=>m.month>current?m.month:current,"");
  const mapValues=useMemo(()=>new Map(areas.map(a=>[a.id,evidenceContext.read(a.id,purpose).percentile])),
    [areas,evidenceContext,purpose]);
  const suggestions=useMemo(()=>{
    const text=normalize(query);
    if(text.length<2)return [];
    return areas.filter(a=>normalize(areaDisplayName(a)).includes(text))
      .sort((a,b)=>Number(!normalize(a.name).startsWith(text))-Number(!normalize(b.name).startsWith(text)))
      .slice(0,7);
  },[areas,query]);
  const compSuggestions=useMemo(()=>{
    const text=normalize(compareQuery);
    if(text.length<2)return [];
    return areas.filter(a=>a.id!==selectedId && normalize(areaDisplayName(a)).includes(text)).slice(0,7);
  },[areas,selectedId,compareQuery]);
  useEffect(()=>{
    if(tab!=="map" || mapBoundaries || mapLoading || mapError) return;
    setMapLoading(true);
    // A deliberate map action is required before downloading city geometries.
    fetch("/v2/api/boundaries/" + city)
      .then(async response => {
        if(!response.ok) throw new Error("Map service unavailable");
        const result: unknown = await response.json();
        if(!Array.isArray(result)) throw new Error("Invalid geometry response");
        setMapBoundaries(result as CityBoundary[]);
      })
      .catch(() => setMapError(true))
      .finally(() => setMapLoading(false));
  },[tab,city,mapBoundaries,mapLoading,mapError]);
  useEffect(()=>{
    const next=new URL(window.location.href);
    next.searchParams.set("view",purpose);
    if(selectedId)next.searchParams.set("area",selectedId);
    else next.searchParams.delete("area");
    window.history.replaceState(window.history.state,"",next.pathname+next.search+next.hash);
    setSaved(readSaved().some(x=>x.id===selectedId&&x.purpose===purpose));
    setShareStatus("");
  },[purpose,selectedId]);

  function selectArea(id:string) {
    setSelectedId(id); setTab("overview"); setQuery(""); setFocused(false);
    setCandidate(null);setGeoError("");setCompareId(null);setCompareQuery("");
  }
  async function lookupAddress(){
    if(query.trim().length<4||geoLoading)return;
    setGeoLoading(true);setGeoError("");setCandidate(null);
    try{
      const matched=await resolvePlaceToArea(query.trim());
      if(matched)setCandidate(matched);
      else setGeoError("No hay una correspondencia precisa en las ciudades cubiertas. Añade la dirección y ciudad completas.");
    }catch{setGeoError("La búsqueda de direcciones no está disponible ahora.");}
    finally{setGeoLoading(false);}
  }
  function shareLink(){
    const next=new URL(window.location.href);
    next.searchParams.set("view",purpose);
    if(selectedId)next.searchParams.set("area",selectedId);
    navigator.clipboard?.writeText(next.toString())
      .then(()=>setShareStatus("Enlace copiado"))
      .catch(()=>setShareStatus("Copia la dirección de esta página"));
    if(!navigator.clipboard)setShareStatus("Copia la dirección de esta página");
  }
  function savePlace(){
    if(!selected)return;
    const next=toggleSaved({id:selected.id,name:selected.name,city,purpose});
    setSaved(next.some(x=>x.id===selected.id&&x.purpose===purpose));
  }
  return <main className="dv2-workspace dv2-container">
    <div className="dv2-crumbs">
      <Link href="/v2">Inicio</Link><span>/</span>
      <Link href="/v2/cities">Ciudades</Link><span>/</span><strong>{label(city)}</strong>
      <span className="dv2-crumbs-status">FUENTES OFICIALES · {latest || "FECHA NO DISPONIBLE"}</span>
    </div>
    <div className="dv2-workspace-header">
      <div><p className="dv2-eyebrow">INVESTIGACIÓN / {label(city).toUpperCase()}</p>
        <h1>{selected?selected.name:"Conoce "+label(city)}<span className="dv2-period">.</span></h1>
        <p>{selected
          ? (selected.parentName||label(city))+" · Investiga la zona desde varias perspectivas."
          : "Empieza por una dirección, un barrio o selecciona directamente un lugar en el mapa."}</p></div>
      <div className="dv2-workspace-tools">
        <span>ESTOY INVESTIGANDO PARA…</span>
        <div className="dv2-switch" role="group" aria-label="Tipo de investigación">
          <button type="button" aria-pressed={purpose==="visitor"} className={purpose==="visitor"?"active":""} onClick={()=>{setPurpose("visitor");setCompareId(null);}}>Viajar</button>
          <button type="button" aria-pressed={purpose==="resident"} className={purpose==="resident"?"active":""} onClick={()=>{setPurpose("resident");setCompareId(null);}}>Vivir</button>
        </div>
      </div>
    </div>

    <div className="dv2-workspace-layout">
      <aside className="dv2-rail" aria-label="Buscar zonas y elegir ciudad">
        <div className="dv2-rail-head"><span>ENCUENTRA UN LUGAR</span><strong>{label(city)}</strong></div>
        <div className="dv2-rail-search">
          <label htmlFor="dv2-research-search">Barrio o dirección</label>
          <input id="dv2-research-search" type="search" value={query}
            placeholder="Buscar en la ciudad…"
            onFocus={()=>setFocused(true)}
            onChange={e=>{setQuery(e.target.value);setFocused(true);setGeoError("");setCandidate(null);}}
            onKeyDown={e=>{if(e.key==="Escape")setFocused(false);
              if(e.key==="Enter"&&suggestions[0])selectArea(suggestions[0].id);}}/>
          {focused&&query.trim().length>=2?<div className="dv2-rail-results">
            {suggestions.map(a=><button type="button" key={a.id} onClick={()=>selectArea(a.id)}>
              <strong>{a.name}</strong><small>{a.parentName||label(city)}</small></button>)}
            <button type="button" className="dv2-lookup-button" disabled={geoLoading||query.trim().length<4}
              onClick={lookupAddress}>{geoLoading?"Buscando…":"Consultar dirección ↗"}</button>
            <small>Solo tras pulsar se consulta el geocodificador de prueba OpenStreetMap.</small>
            {candidate?<div className="dv2-found">
              <strong>Confirma la ubicación</strong><p>{candidate.matchedPlace}</p>
              {candidate.locationKind==="broad"
                ? <Link href={"/v2/explore/"+candidate.citySlug+"?view="+purpose+"&area="+encodeURIComponent(candidate.id)}>Explorar {candidate.name} →</Link>
                : <Link href={locationReportHref({latitude:candidate.latitude,longitude:candidate.longitude,
                    label:candidate.matchedPlace,view:purpose})}>Crear informe de esta ubicación →</Link>}
            </div>:null}
            {geoError?<p role="alert" className="dv2-error">{geoError}</p>:null}
          </div>:null}
        </div>
        <div className="dv2-rail-directory">
          <span>{selected?"SIGUIENTE DECISIÓN":"EXPLORAR SIN BUSCAR"}</span>
          <button type="button" onClick={()=>setTab("map")}>
            <strong>{selected?"Volver al mapa":"Elegir sobre el mapa"} ↗</strong>
            <small>{areas.length} zonas oficiales disponibles</small>
          </button>
          {selected?<button type="button" onClick={()=>setTab("compare")}>
            <strong>Comparar esta zona →</strong>
            <small>Con otra de la misma ciudad</small>
          </button>:null}
          <small>No mostramos una selección arbitraria de barrios como si fuesen recomendaciones.</small>
        </div>
        <div className="dv2-rail-city">
          <span>CAMBIAR DE CIUDAD</span>
          <Link href={"/v2/explore/"+(city==="madrid"?"london":"madrid")+"?view="+purpose}>
            {city==="madrid"?"Londres":"Madrid"} <span aria-hidden="true">↗</span>
          </Link>
          <Link href="/v2/cities">Ver todas las ciudades</Link>
        </div>
      </aside>

      <div className="dv2-main">
        <nav className="dv2-viewnav" aria-label="Modos de exploración">
          {([["overview","Panorama"],["map","Mapa"],["compare","Comparar"]] as const).map(([key,value])=>
            <button type="button" key={key} aria-current={tab===key?"page":undefined}
              className={tab===key?"active":""} onClick={()=>setTab(key)}>{value}</button>)}
          <span className="dv2-viewnav-spacer"/>
          {selected?<button className="dv2-share" type="button" onClick={shareLink}>Compartir ↗</button>:null}
        </nav>
        {shareStatus?<p className="dv2-share-status" role="status">{shareStatus}</p>:null}

        {tab==="overview" ? selected&&evidence ? <div className="dv2-overview">
          <div className="dv2-overview-primary">
            <span className="dv2-eyebrow">{purpose==="visitor"?"ANTES DE IR":"ANTES DE MUDARTE"} / {selected.name.toUpperCase()}</span>
            <h2>{purpose==="visitor"?"Qué muestran los datos de esta zona":"Cómo interpretar este barrio"}</h2>
            <p className="dv2-intro">Un punto de partida para investigar, no una conclusión sobre la seguridad de sus calles o habitantes.</p>
            <section className="dv2-observation">
              <div className="dv2-observation-head"><span>01 / INDICADOR COMPROBADO</span><span>{evidence.period||"SIN PERÍODO COMPARABLE"}</span></div>
              <h3>{indicator}</h3>
              {evidence.available ? <><div className="dv2-reading"><strong>{fmt(evidence.value)}</strong><span>{evidence.unit}</span></div>
                <div className="dv2-relative"><strong>{relative===null?"Sin comparación":relativeLabels[relative-1]}</strong>
                  <div className="dv2-bands" aria-label="Posición del indicador en esta ciudad">
                    {MAP_COLOR_BANDS.map((band,i)=><i key={band.max} className={i+1===relative?"current":""}
                      style={{background:band.color}}/>)}</div>
                  <p>Posición relativa de este indicador dentro de {label(city)}. El color no mide el peligro personal.</p>
                </div></> : <div className="dv2-no-data"><strong>No hay información comparable para esta zona.</strong><p>No interpretamos las observaciones ausentes como cero, ni sustituimos el indicador por otro diferente.</p></div>}
              <p className="dv2-evidence-description">{placeEvidenceExplanation(city,purpose,evidenceContext.hasCityHarmSeries,"es")}</p>
              {isMadridDispatchLocationCaveat(city,selected.name)?<SourceLocationCaveat locale="es"/>:null}
              <div className="dv2-evidence-foot"><span>Fuente · {source.label}</span><a href={source.url} target="_blank" rel="noreferrer">Ver origen ↗</a></div>
            </section>
            <div className="dv2-context-grid">
              <section><span>02 / LO QUE NO PODEMOS AFIRMAR</span><h3>No es una predicción.</h3>
                <p>{purpose==="visitor"
                  ?"Una alta concentración de hurtos puede coexistir con mucha actividad turística. Faltan datos de afluencia comparables para estimar el riesgo de un visitante."
                  :"Una tasa de registros no resume la experiencia de vivir en un barrio. Su reputación histórica o composición social no son medidas de seguridad."}</p></section>
              <section><span>03 / LO QUE VIENE DESPUÉS</span><h3>El contexto cuenta.</h3>
                <p>{purpose==="visitor"
                  ?"Indicaciones locales concretas y calles: solo cuando existan evidencias geográficas suficientemente precisas. Ahora no hay calles verificadas cargadas."
                  :"Transporte, servicios, vivienda y evolución urbana: módulos previstos, pendientes de fuentes comprobadas. No les asignamos notas ficticias."}</p></section>
            </div>
          </div>
          <aside className="dv2-next-panel">
            <span className="dv2-eyebrow">TU SIGUIENTE PASO</span><h3>¿Y ahora?</h3>
            <p>{purpose==="visitor"?"Comprueba otra zona antes de decidir dónde alojarte.":"Contrasta otro barrio antes de sacar conclusiones."}</p>
            <button type="button" className="dv2-button" onClick={()=>setTab("compare")}>Comparar otra zona →</button>
            <button type="button" className="dv2-alt-button" onClick={()=>setTab("map")}>Explorar en el mapa ↗</button>
            <button type="button" className="dv2-alt-button" onClick={savePlace}>
              {saved?"✓ Guardado · Quitar":"＋ Guardar zona"}</button>
            <div className="dv2-next-fine"><strong>Sobre calles concretas</strong>
              <p>{city==="london"?"La fuente británica publica posiciones anonimizadas y aproximadas, no el lugar exacto donde ocurrió cada incidente.":"La fuente municipal integrada no respalda todavía recomendaciones a escala de calle."} Nunca señalaremos una calle sin evidencia adecuada.</p>
              <Link href="/v2/guide">Ver nuestros criterios ↗</Link>
            </div>
          </aside>
        </div> : <div className="dv2-start">
          <span className="dv2-eyebrow">BIENVENIDO A {label(city).toUpperCase()}</span>
          <h2>Primero el lugar.<br/><em>Después los datos.</em></h2>
          <p>Escoge un barrio en el buscador, selecciona una zona en el mapa o introduce una dirección completa. Aquí aparecerá una ficha con la fuente y sus límites, adaptada a {purpose==="visitor"?"tu viaje":"tu búsqueda de vivienda"}.</p>
          <button type="button" className="dv2-button" onClick={()=>setTab("map")}>Abrir mapa de {label(city)} →</button>
          <div className="dv2-start-metrics"><strong>{areas.length}</strong><span>zonas oficiales en el explorador</span><strong>{latest||"—"}</strong><span>último período disponible</span></div>
        </div> : null}

        {tab==="map"? <div className="dv2-map-view">
          <div className="dv2-map-intro">
            <div><span className="dv2-eyebrow">MAPA / {label(city).toUpperCase()}</span>
              <h2>Explora el territorio.</h2>
              <p>Los colores representan únicamente <strong>{indicator.toLowerCase()}</strong>. Selecciona una zona para abrir su ficha.</p></div>
            <div className="dv2-mini-legend"><div>{MAP_COLOR_BANDS.map((band,i)=><i key={band.max} style={{background:band.color}}/>)}</div><small>Menos registros ← → Más registros</small><small>Gris: sin datos comparables</small></div>
          </div>
          <div className="dv2-map-frame">
            {mapBoundaries ? <AtlasMap city={city} boundaries={mapBoundaries} areas={areas} values={mapValues}
              selectedId={selectedId} onSelect={selectArea} locale="es"/> : <div className="dv2-map-placeholder" role="status">
                {mapError ? <><strong>El mapa no se ha podido cargar.</strong>
                  <p>Puedes seguir investigando mediante el buscador y la ficha, sin perder la selección.</p>
                  <button type="button" onClick={()=>setMapError(false)}>Volver a intentar</button></>
                  : <><strong>Preparando el mapa de {label(city)}…</strong>
                    <p>Descargamos la cartografía solo cuando decides abrirla.</p></>}
              </div>}
          </div>
          <p className="dv2-map-warning">La comparación se realiza dentro de la misma ciudad. Este mapa no indica por dónde es seguro caminar ni identifica calles peligrosas.</p>
        </div>:null}

        {tab==="compare"? <div className="dv2-compare-view">
          <span className="dv2-eyebrow">COMPARACIÓN / {label(city).toUpperCase()}</span><h2>Dos lugares.<br/><em>Los mismos criterios.</em></h2>
          {!selected?<p>Selecciona primero una zona desde el buscador para comenzar una comparación.</p>:<>
            <p>Comparamos exclusivamente el mismo indicador dentro de la misma ciudad, con fechas explícitas.</p>
            <div className="dv2-compare-controls"><div><label>PRIMERA ZONA</label><strong>{selected.name}</strong></div>
              <div className="dv2-compare-input"><label htmlFor="dv2-compare-search">SEGUNDA ZONA</label>
                <input id="dv2-compare-search" value={compareQuery} onChange={e=>{setCompareQuery(e.target.value);setCompareId(null);}}
                  placeholder="Buscar otro barrio…" type="search"/>
                {compareQuery.trim().length>=2&&!comparison?<div className="dv2-compare-suggest">
                  {compSuggestions.map(a=><button key={a.id} type="button"
                    onClick={()=>{setCompareId(a.id);setCompareQuery(areaDisplayName(a));}}>{a.name}<small>{a.parentName||label(city)}</small></button>)}
                  {!compSuggestions.length?<p>Sin coincidencias</p>:null}
                </div>:null}</div></div>
            {comparison&&compareEvidence&&evidence?<div className="dv2-compare-result">
              {[{area:selected,e:evidence},{area:comparison,e:compareEvidence}].map(item=><section key={item.area.id}>
                <small>{item.area.parentName||label(city)}</small><h3>{item.area.name}</h3>
                <strong>{item.e.available?fmt(item.e.value):"Sin dato"}</strong>
                <p>{indicator}</p><small>{item.e.period||"Período no disponible"}</small>
              </section>)}
              <p className="dv2-compare-warning">{evidence.period!==compareEvidence.period
                ?"Los períodos de observación no coinciden: no interpretes las cifras como una comparación temporal equivalente."
                :"Mismo indicador y período; las cifras no representan la probabilidad personal de sufrir un incidente."}</p>
            </div>:null}
          </>}
        </div>:null}
      </div>
    </div>
  </main>;
}
