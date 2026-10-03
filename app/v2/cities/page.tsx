import Link from "next/link";
import { v2Cities } from "@/lib/v2-city-catalog";

export default function CitiesPage() {
  return <main className="dv2-container d3-cities">
    <Link href="/v2" className="d3-back">← Volver al inicio</Link>
    <p className="dv2-eyebrow">COBERTURA VERIFICADA / HOJA DE RUTA</p>
    <h1>Ciudades con datos.<br/><em>Y ciudades que investigamos.</em></h1>
    <p>Solo Madrid y Londres tienen información integrada actualmente. El resto aparece para explicar qué estamos estudiando; no permite generar informes de seguridad ficticios.</p>
    <div className="d3-citygrid">
      {v2Cities.map(c => <article key={c.slug} className={c.status==="live"?"live":""}>
        <div className="d3-city-status">{c.status==="live"?"DATOS ACTIVOS":
          c.status==="source-review"?"FUENTES EN REVISIÓN":"EN INVESTIGACIÓN"}</div>
        <h2>{c.label}</h2><span>{c.country}</span>
        <p>{c.note}</p>
        {c.status==="live"?<div className="d3-city-actions">
          <Link href={"/v2/explore/"+c.slug+"?view=visitor"}>Explorar zonas ↗</Link>
          <Link href="/v2/choose">Comparar direcciones ↗</Link>
        </div>:c.source?<a className="d3-city-source" href={c.source} target="_blank" rel="noopener noreferrer">Consultar fuente candidata ↗</a>
          :<span className="d3-city-source">Sin fuentes locales validadas</span>}
      </article>)}
    </div>
  </main>;
}
