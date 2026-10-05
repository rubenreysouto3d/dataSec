"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { locateAreaByCoordinates, resolvePlaceToArea } from "@/lib/public-data-client";
import { readSaved, type SavedPlace } from "@/lib/v2-saved";

type State="idle"|"searching"|"locating"|"error";

function savedHref(place:SavedPlace){
  const lens=place.purpose==="resident"?"living_here":"overview";
  const params=new URLSearchParams({lens,view:place.purpose});
  if(place.areaId)params.set("area",place.areaId);
  if(place.latitude!==undefined&&place.longitude!==undefined){
    params.set("lat",String(place.latitude));
    params.set("lng",String(place.longitude));
    params.set("place",place.name);
  }
  return "/v2/explore/"+place.city+"?"+params.toString();
}

export default function V2Start(){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState("");
  const [state,setState]=useState<State>("idle");
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<SavedPlace[]>([]);

  useEffect(()=>{
    setSaved(readSaved().slice(0,5));
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="/"&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
        const target=event.target as HTMLElement|null;
        if(target?.tagName==="INPUT"||target?.tagName==="TEXTAREA")return;
        event.preventDefault();inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);

  async function search(){
    const value=query.trim();
    if(value.length<3||state==="searching")return;
    setState("searching");setError("");
    try{
      const result=await resolvePlaceToArea(value);
      if(!result){
        setState("error");
        setError("No encontramos ese lugar dentro de la cobertura actual.");
        return;
      }
      const params=new URLSearchParams({
        lens:"overview",
        view:"visitor",
        area:result.id,
        lat:String(result.latitude),
        lng:String(result.longitude),
        place:result.matchedPlace,
      });
      router.push("/v2/explore/"+result.citySlug+"?"+params.toString());
    }catch{
      setState("error");
      setError("La búsqueda de lugares no está disponible ahora.");
    }
  }

  function useLocation(){
    if(state==="locating")return;
    if(!navigator.geolocation){
      setState("error");setError("Este navegador no permite usar la ubicación.");
      return;
    }
    setState("locating");setError("");
    navigator.geolocation.getCurrentPosition(async position=>{
      try{
        const latitude=position.coords.latitude;
        const longitude=position.coords.longitude;
        const area=await locateAreaByCoordinates(latitude,longitude);
        if(!area){
          setState("error");
          setError("Tu ubicación está fuera de la cobertura actual.");
          return;
        }
        const params=new URLSearchParams({
          lens:"around_me",
          view:"visitor",
          area:area.id,
          lat:String(latitude),
          lng:String(longitude),
          place:"Tu ubicación aproximada",
        });
        router.push("/v2/explore/"+area.citySlug+"?"+params.toString());
      }catch{
        setState("error");setError("No hemos podido situarte dentro de la cobertura.");
      }
    },()=>{
      setState("error");setError("No hemos podido acceder a tu ubicación.");
    },{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  }

  return <main className="op-start">
    <section className="op-command" aria-labelledby="op-title">
      <div className="op-command-head">
        <span>DATASEC</span>
        <small>MADRID · LONDON</small>
      </div>

      <h1 id="op-title">¿Qué lugar quieres entender?</h1>

      <form onSubmit={event=>{event.preventDefault();void search();}} className="op-search">
        <span aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={event=>{setQuery(event.target.value);setError("");if(state==="error")setState("idle");}}
          placeholder="Dirección, hotel, calle o lugar"
          aria-label="Dirección, hotel, calle o lugar"
          autoComplete="off"
        />
        <kbd>/</kbd>
        <button type="submit" disabled={query.trim().length<3||state==="searching"}>
          {state==="searching"?"Buscando…":"Abrir"}
        </button>
      </form>

      <div className="op-actions">
        <button type="button" onClick={useLocation} disabled={state==="locating"}>
          <span aria-hidden="true">⌖</span>
          <strong>{state==="locating"?"Localizando…":"Usar mi ubicación"}</strong>
          <small>Consulta el contexto del punto en el que estás</small>
        </button>
        <a href="/v2/cities">
          <span aria-hidden="true">↗</span>
          <strong>Explorar sin una dirección</strong>
          <small>Ver cobertura y elegir una ciudad</small>
        </a>
      </div>

      {error?<p className="op-error" role="alert">{error}</p>:null}

      {saved.length?<section className="op-recent" aria-labelledby="op-recent-title">
        <div className="op-recent-title">
          <span id="op-recent-title">RECIENTES / GUARDADOS</span>
          <a href="/v2/saved">Ver todos</a>
        </div>
        <div>
          {saved.map(place=><a href={savedHref(place)} key={place.id+"|"+place.purpose}>
            <strong>{place.name}</strong>
            <span>{place.city==="madrid"?"Madrid":"Londres"}</span>
          </a>)}
        </div>
      </section>:null}
    </section>

    <aside className="op-status">
      <span>COBERTURA ACTUAL</span>
      <div>
        <strong>Madrid</strong>
        <small>Barrio · datos municipales · nuevas capas en integración</small>
      </div>
      <div>
        <strong>London</strong>
        <small>Barrio + puntos policiales aproximados</small>
      </div>
      <p>La precisión depende de cada fuente. DataSec muestra lo que sabe y también lo que no.</p>
    </aside>
  </main>;
}
