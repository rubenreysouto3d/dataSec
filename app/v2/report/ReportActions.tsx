"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { locationReportHref, type ReportPoint } from "@/lib/location-report";
import { readSaved, toggleSaved } from "@/lib/v2-saved";
import type { NearbyPlace, NearbyCategory } from "@/lib/nearby-places";

type NearbyResponse = { places:NearbyPlace[]; attribution:string; completeness:string; distance:string };
const sections: {key:NearbyCategory;name:string;icon:string}[] = [
  {key:"transport",name:"Metro y tren",icon:"↗"},
  {key:"groceries",name:"Alimentación",icon:"⌂"},
  {key:"pharmacy",name:"Farmacias",icon:"+"},
  {key:"health",name:"Salud",icon:"+"},
];

function osmLink(lat:number,lng:number) {
  return "https://www.openstreetmap.org/?mlat="+lat+"&mlon="+lng+"#map=17/"+lat+"/"+lng;
}

export function NearbyServices({point}:{point:ReportPoint}) {
  const [state,setState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [data,setData]=useState<NearbyResponse|null>(null);
  async function load() {
    if(state==="loading")return;
    setState("loading");
    try {
      const params=new URLSearchParams({lat:String(point.latitude),lng:String(point.longitude)});
      const res=await fetch("/v2/api/nearby?"+params.toString());
      if(!res.ok)throw new Error("service unavailable");
      const value=(await res.json()) as NearbyResponse;
      if(!Array.isArray(value.places))throw new Error("invalid response");
      setData(value);setState("ready");
    }catch{setState("error");}
  }
  return <section className="drep-amenities" aria-label="Servicios cercanos">
    <header><div><span className="drep-eyebrow">02 / VIDA PRÁCTICA</span>
      <h2>¿Qué tienes alrededor?</h2></div><small>Información complementaria de OpenStreetMap</small></header>
    <p>Busca establecimientos y estaciones cartografiados cerca del punto seleccionado. La distancia es aproximada en línea recta, no andando.</p>
    {state==="idle"&&<button type="button" className="drep-primary-action" onClick={load}>Consultar servicios cercanos ↗</button>}
    {state==="loading"&&<p role="status">Consultando los servicios disponibles…</p>}
    {state==="error"&&<div role="status" className="drep-unavailable"><strong>No hemos podido consultar el entorno.</strong>
      <p>La información principal del barrio sigue disponible. Puedes reintentar la consulta.</p>
      <button type="button" onClick={load}>Reintentar ↗</button></div>}
    {state==="ready"&&data&&<>
      <div className="drep-nearby-grid">{sections.map(section=>{
        const items=data.places.filter(p=>p.category===section.key);
        return <div className="drep-nearby-group" key={section.key}>
          <h3><span>{section.icon}</span>{section.name}</h3>
          {items.length?items.map(p=><a key={p.id} target="_blank" rel="noopener noreferrer"
            href={osmLink(p.latitude,p.longitude)}>
              <span>{p.name}</span><strong>~{p.distanceMeters} m ↗</strong>
            </a>):<p>Sin lugares identificados en esta consulta.</p>}
        </div>;
      })}</div>
      <p className="drep-smallprint">{data.attribution}. Estos registros son colaborativos, no un censo exhaustivo: la ausencia de resultados no demuestra que no existan servicios.</p>
    </>}
  </section>;
}

export function ReportSave({point,areaId,city}:{point:ReportPoint;areaId:string;city:"madrid"|"london"}) {
  const key="point:"+point.latitude.toFixed(5)+":"+point.longitude.toFixed(5);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{
    setSaved(readSaved().some(x=>x.id===key&&x.purpose===point.view));
  },[key,point.view]);
  return <button type="button" className="drep-save" aria-pressed={saved} onClick={()=>{
    const now=toggleSaved({
      id:key,areaId,name:point.label,city,purpose:point.view,
      latitude:point.latitude,longitude:point.longitude,
    });
    setSaved(now.some(x=>x.id===key&&x.purpose===point.view));
  }}>{saved?"✓ Guardado":"＋ Guardar ubicación"}</button>;
}

export function ReportShare({point}:{point:ReportPoint}) {
  const [status,setStatus]=useState("");
  return <span className="drep-share-wrap">
    <button type="button" onClick={async()=>{
      try {
        await navigator.clipboard.writeText(window.location.origin+locationReportHref(point));
        setStatus("Enlace copiado");
      }catch{setStatus("Puedes copiar la dirección del navegador.");}
    }}>Compartir ↗</button>
    <small className="drep-share-caveat">Compartir revela la ubicación consultada.</small>
    {status&&<small role="status">{status}</small>}
  </span>;
}

export function ReportMap({point}:{point:ReportPoint}) {
  const [expanded,setExpanded]=useState(false);
  const lat=point.latitude,lon=point.longitude;
  const bbox=[lon-.006,lat-.004,lon+.006,lat+.004].join(",");
  const url="https://www.openstreetmap.org/export/embed.html?"+new URLSearchParams({
    bbox,layer:"mapnik",marker:lat+","+lon,
  }).toString();
  return <div className="drep-map">
    {expanded?<iframe title="Mapa de ubicación aproximada"
      referrerPolicy="strict-origin-when-cross-origin" loading="lazy" src={url}/>:
      <div className="drep-map-gate"><div className="drep-target" aria-hidden="true"><span>⌖</span></div>
        <strong>Ver el punto seleccionado</strong>
        <p>El mapa se carga solo si lo abres. No representa dónde ocurrieron los incidentes.</p>
        <button type="button" onClick={()=>setExpanded(true)}>Abrir mapa ↗</button></div>}
    <a href={osmLink(lat,lon)} target="_blank" rel="noopener noreferrer">Abrir en OpenStreetMap ↗</a>
    <small>© OpenStreetMap contributors · ubicación geocodificada; podría ser el centro del lugar y no una entrada exacta.</small>
  </div>;
}
