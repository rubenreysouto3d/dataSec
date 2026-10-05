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
      else setError("No encontramos esa dirección en las ciudades cubiertas. Añade calle, número y ciudad.");
    }catch{
      setError("La búsqueda de direcciones no está disponible ahora.");
    }finally{
      setLoading(false);
    }
  }

  return <main className="place-home dv2-container">
    <section className="place-home-main">
      <span className="dv2-eyebrow">DATASEC / BUSCA UN SITIO CONCRETO</span>
      <h1>Dime dónde.<br/><em>Luego vemos qué importa.</em></h1>
      <p>Una dirección, hotel o lugar concreto. Te mostramos qué sabemos de su zona y qué tienes alrededor, sin convertirlo todo en una nota absurda.</p>

      <div className="place-purpose" role="group" aria-label="Para qué quieres comprobar el lugar">
        <button type="button" className={purpose==="visitor"?"active":""} aria-pressed={purpose==="visitor"}
          onClick={()=>{setPurpose("visitor");setCandidate(null);}}>
          Voy de viaje
        </button>
        <button type="button" className={purpose==="resident"?"active":""} aria-pressed={purpose==="resident"}
          onClick={()=>{setPurpose("resident");setCandidate(null);}}>
          Quiero vivir aquí
        </button>
      </div>

      <div className="place-search" id="buscar">
        <label htmlFor="place-search-input">Dirección, hotel o lugar</label>
        <div className="place-search-row">
          <input id="place-search-input" type="search" value={query}
            onChange={e=>{setQuery(e.target.value);setCandidate(null);setError("");}}
            disabled={!available}
            placeholder="Ej.: Puerta del Sol 1, Madrid"
            onKeyDown={e=>{if(e.key==="Enter")void searchAddress();}}/>
          <button type="button" disabled={!available||loading||query.trim().length<5}
            onClick={searchAddress}>{loading?"Buscando…":"Comprobar lugar →"}</button>
        </div>

        {candidate?<div className="place-candidate" role="status">
          <small>UBICACIÓN ENCONTRADA</small>
          <strong>{candidate.matchedPlace}</strong>
          {candidate.locationKind==="specific"
            ? <button type="button" onClick={()=>router.push(locationReportHref({
                latitude:candidate.latitude,longitude:candidate.longitude,
                label:candidate.matchedPlace,view:purpose,
              }))}>Ver qué sabemos de este sitio →</button>
            : <p>El resultado es demasiado amplio. Añade una calle y número para abrir un informe de ubicación.</p>}
        </div>:null}

        {error&&<p role="alert" className="place-error">{error}</p>}
        {!available&&<p role="status" className="place-error">Los datos no están disponibles ahora.</p>}

        {matches.length>0&&<div className="place-area-hints">
          <small>Si buscabas una zona:</small>
          {matches.map(a=><Link key={a.id} href={"/v2/explore/"+a.citySlug+"?view="+purpose+
            "&area="+encodeURIComponent(a.id)}>{a.name} · {a.citySlug==="madrid"?"Madrid":"Londres"} ↗</Link>)}
        </div>}
      </div>

      <div className="place-example">
        <span>¿Quieres ver cómo funciona?</span>
        <Link href={locationReportHref({
          latitude:40.4169,longitude:-3.7034,label:"Puerta del Sol, Madrid",view:purpose,
        })}>Abrir ejemplo: Puerta del Sol ↗</Link>
      </div>
    </section>

    <aside className="place-home-secondary">
      <div>
        <span className="dv2-eyebrow">SI AÚN NO TIENES DIRECCIÓN</span>
        <h2>Explora primero la ciudad.</h2>
        <p>Usa el mapa para entender zonas y después baja a un punto concreto.</p>
      </div>
      <div className="place-city-links">
        <Link href={"/v2/explore/madrid?view="+purpose}><strong>Madrid</strong><span>Abrir mapa ↗</span></Link>
        <Link href={"/v2/explore/london?view="+purpose}><strong>Londres</strong><span>Abrir mapa ↗</span></Link>
      </div>
      <div className="place-secondary-links">
        <Link href="/v2/saved">Lugares guardados →</Link>
        <Link href="/v2/cities">Cobertura →</Link>
        <Link href="/v2/guide">Qué datos usamos →</Link>
      </div>
    </aside>
  </main>;
}
