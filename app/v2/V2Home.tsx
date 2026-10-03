"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { locationReportHref } from "@/lib/location-report";

type Area = { id:string;name:string;parentName:string|null;citySlug:"madrid"|"london" };
type Purpose = "visitor"|"resident";
function norm(value:string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

export default function V2Home({areas,available}:{areas:Area[];available:boolean}){
  const router=useRouter();
  const [purpose,setPurpose]=useState<Purpose>("visitor");
  const [query,setQuery]=useState("");
  const [candidate,setCandidate]=useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const matches=useMemo(()=>{
    const q=norm(query);
    if(q.length<2)return [];
    return areas.filter(a=>norm(a.name+" "+(a.parentName||"")+" "+a.citySlug).includes(q)).slice(0,4);
  },[areas,query]);
  async function searchAddress(){
    if(query.trim().length<5||loading)return;
    setLoading(true);setError("");setCandidate(null);
    try{
      const match=await resolvePlaceToArea(query.trim());
      if(match)setCandidate(match);
      else setError("No encontramos una dirección compatible en Madrid o Londres. Indica calle, número y ciudad.");
    }catch{setError("La consulta de direcciones no está disponible ahora.");}
    finally{setLoading(false);}
  }
  return <main className="d3-home dv2-container">
    <div className="d3-hero">
      <span className="dv2-eyebrow">DATASEC / EMPIEZA POR LO QUE NECESITAS SABER</span>
      <h1>¿Qué quieres saber<br/><em>de ese lugar?</em></h1>
      <p>Compara dos direcciones antes de reservar o mudarte, o investiga una ubicación concreta.
        Sin rankings inventados de barrios ni advertencias sin datos.</p>
      <div className="d3-purpose" role="group" aria-label="Tu objetivo">
        <button type="button" className={purpose==="visitor"?"active":""} aria-pressed={purpose==="visitor"}
          onClick={()=>{setPurpose("visitor");setCandidate(null);}}>Voy de viaje</button>
        <button type="button" className={purpose==="resident"?"active":""} aria-pressed={purpose==="resident"}
          onClick={()=>{setPurpose("resident");setCandidate(null);}}>Quiero mudarme</button>
      </div>
    </div>

    <section className="d3-actions" aria-label="Qué necesitas hacer">
      <Link href={"/v2/choose?view="+purpose} className="d3-primary-card">
        <span>01 / COMPARAR</span>
        <h2>Tengo dos opciones.<br/>¿Qué cambia entre ellas?</h2>
        <p>Busca dos direcciones y contrasta registros realmente comparables, transporte
          y servicios concretos cerca de cada una.</p>
        <strong>Comparar dos ubicaciones <span aria-hidden="true">↗</span></strong>
      </Link>
      <div className="d3-search-card">
        <span>02 / COMPROBAR UN LUGAR</span>
        <h2>Quiero investigar<br/>una dirección.</h2>
        <label htmlFor="d3-search">Calle y número, ciudad</label>
        <div className="d3-search-line"><input id="d3-search" type="search" value={query}
          onChange={e=>{setQuery(e.target.value);setCandidate(null);setError("");}}
          disabled={!available} placeholder="Ej.: Puerta del Sol 1, Madrid"
          onKeyDown={e=>{if(e.key==="Enter")void searchAddress();}}/>
          <button type="button" disabled={!available||loading||query.trim().length<5}
            onClick={searchAddress}>{loading?"Buscando…":"Buscar ↗"}</button></div>
        {candidate?<div className="d3-candidate" role="status">
          <small>CONFIRMA QUE ES TU UBICACIÓN</small>
          <strong>{candidate.matchedPlace}</strong>
          {candidate.locationKind==="specific"
            ? <button type="button" onClick={()=>router.push(locationReportHref({
              latitude:candidate.latitude,longitude:candidate.longitude,
              label:candidate.matchedPlace,view:purpose,
            }))}>Abrir informe de esta ubicación →</button>
            : <p>El resultado es demasiado amplio para informar sobre una dirección.
              Indica una calle y un número.</p>}
        </div>:null}
        {error&&<p role="alert" className="d3-error">{error}</p>}
        {!available&&<p role="status">Los datos no están disponibles. No mostramos ubicaciones de prueba como reales.</p>}
        {matches.length>0&&<div className="d3-areamatches"><small>También puedes explorar barrios:</small>
          {matches.map(a=><Link key={a.id} href={"/v2/explore/"+a.citySlug+"?view="+purpose+
            "&area="+encodeURIComponent(a.id)}>{a.name} · {a.citySlug==="madrid"?"Madrid":"Londres"} ↗</Link>)}</div>}
        <p className="d3-provider">La consulta de dirección se realiza solo al pulsar Buscar.
          Se utiliza un geocodificador externo de prueba.</p>
      </div>
    </section>
    <section className="d3-live-example" aria-label="Probar la herramienta">
      <div><span>PRUEBA SIN BUSCAR</span><strong>Dos ubicaciones reales de Madrid</strong>
        <p>Puntos de demostración geográfica; los registros cargados son oficiales y los servicios
          se consultan al solicitarlos.</p></div>
      <Link href={"/v2/choose?view="+purpose+
        "&alat=40.416900&alng=-3.703400&aplace=Puerta+del+Sol%2C+Madrid"+
        "&blat=40.427000&blng=-3.701900&bplace=Glorieta+de+Bilbao%2C+Madrid"}>
          Comparar Sol y Bilbao ↗</Link>
    </section>
    <section className="d3-next">
      <div><span className="dv2-eyebrow">DESPUÉS, EXPLORA</span><h2>¿Todavía no tienes una dirección?</h2>
        <p>Consulta las zonas disponibles de Madrid y Londres. Las demás ciudades permanecen
          en investigación hasta que haya fuentes verificadas.</p></div>
      <div><Link href={"/v2/explore/madrid?view="+purpose}>Madrid ↗</Link>
        <Link href={"/v2/explore/london?view="+purpose}>Londres ↗</Link>
        <Link href="/v2/cities">Cobertura y próximas ciudades →</Link></div>
    </section>
  </main>;
}
