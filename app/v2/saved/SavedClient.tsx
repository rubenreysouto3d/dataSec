"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { readSaved, type SavedPlace, toggleSaved } from "@/lib/v2-saved";
export default function SavedClient() {
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  useEffect(() => {
    const sync = () => setSaved(readSaved());
    sync();
    window.addEventListener("datasec:saved", sync);
    return () => window.removeEventListener("datasec:saved", sync);
  }, []);
  return <main className="dv2-container dv2-saved-page">
    <p className="dv2-eyebrow">TU INVESTIGACIÓN</p><h1>Lugares guardados<span className="dv2-period">.</span></h1>
    <p className="dv2-lede">Tus zonas de interés, listas para volver a consultarlas. De momento se guardan únicamente en este navegador, sin crear una cuenta.</p>
    {!saved.length ? <div className="dv2-empty-saved"><h2>Aún no has guardado ningún lugar.</h2><p>Explora una zona y pulsa Guardar. Aquí tendrás tus alternativas.</p><Link className="dv2-button" href="/v2#ciudades">Explorar ciudades →</Link></div> : null}
    <div className="dv2-saved-list">{saved.map(p => <article key={p.id+p.purpose}>
      <div><small>{p.city === "madrid" ? "MADRID" : "LONDRES"} · {p.purpose === "visitor" ? "VIAJE" : "MUDANZA"}</small><h2>{p.name}</h2></div>
      <div><Link href={"/v2/explore/"+p.city+"?view="+p.purpose+"&area="+encodeURIComponent(p.id)}>Volver a la ficha →</Link>
      <button type="button" onClick={() => setSaved(toggleSaved(p))}>Eliminar</button></div></article>)}</div>
  </main>;
}
