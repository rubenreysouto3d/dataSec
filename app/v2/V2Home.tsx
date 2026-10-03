"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { v2Cities } from "@/lib/v2-city-catalog";
import { locationReportHref } from "@/lib/location-report";

type Area = { id: string; name: string; parentName: string | null; citySlug: "madrid" | "london" };
type Purpose = "visitor" | "resident";

function normalise(input: string) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function explorer(area: Pick<Area, "citySlug" | "id">, purpose: Purpose) {
  return "/v2/explore/" + area.citySlug + "?view=" + purpose + "&area=" + encodeURIComponent(area.id);
}

export default function V2Home({ areas, available }: { areas: Area[]; available: boolean }) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose>("visitor");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [candidate, setCandidate] = useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);

  const matches = useMemo(() => {
    const text = normalise(query);
    if (text.length < 2) return [];
    return areas.filter(a => normalise(a.name+" "+(a.parentName||"")+" "+a.citySlug).includes(text))
      .sort((a,b) => Number(!normalise(a.name).startsWith(text))-Number(!normalise(b.name).startsWith(text)))
      .slice(0,5);
  }, [areas,query]);

  const cityMatch = v2Cities.filter(c => c.status === "live" &&
    normalise(c.label+" "+c.slug).includes(normalise(query)) && normalise(query).length > 1);

  function goArea(area: Pick<Area,"id"|"citySlug">) { router.push(explorer(area,purpose)); }
  async function lookUpAddress() {
    if (query.trim().length < 4 || loading) return;
    setLoading(true); setLookupError(""); setCandidate(null);
    try {
      // Prototype Nominatim: explicit, user-initiated lookup, never background/autocomplete.
      const match = await resolvePlaceToArea(query.trim());
      if (match) setCandidate(match);
      else setLookupError("No encontramos una correspondencia suficientemente precisa dentro de la cobertura actual. Añade una dirección y ciudad completas.");
    } catch { setLookupError("La consulta de direcciones no está disponible ahora mismo."); }
    finally { setLoading(false); }
  }
  return <main>
    <section className="dv2-hero dv2-hero-report dv2-container" aria-labelledby="dv2-title">
      <div className="dv2-hero-main">
        <span className="dv2-eyebrow"><span className="dv2-live-dot"/> DATASEC / CONOCE EL TERRENO</span>
        <h1 id="dv2-title">Antes de ir,<br/><em>investiga.</em></h1>
        <p>Busca una dirección. Te mostramos datos reales de su entorno y lo que todavía desconocemos.</p>
        <div className="dv2-search-panel">
          <p className="dv2-step">01 <span>¿Qué estás planeando?</span></p>
          <div className="dv2-purpose-picker" role="group" aria-label="Elige el objetivo de tu investigación">
            <button className={purpose==="visitor"?"active":""} type="button" aria-pressed={purpose==="visitor"}
              onClick={() => { setPurpose("visitor"); setCandidate(null); }}>
              <span aria-hidden="true">↗</span><strong>Voy de viaje</strong><small>Elegir dónde alojarme y qué tener en cuenta</small>
            </button>
            <button className={purpose==="resident"?"active":""} type="button" aria-pressed={purpose==="resident"}
              onClick={() => { setPurpose("resident"); setCandidate(null); }}>
              <span aria-hidden="true">⌂</span><strong>Quizá me mude</strong><small>Entender barrios y comparar alternativas</small>
            </button>
          </div>
          <p className="dv2-step">02 <span>¿Qué lugar quieres investigar?</span></p>
          <div className="dv2-home-search-wrap">
          <div className="dv2-home-search">
            <label htmlFor="dv2-search" className="dv2-sr-only">Ciudad, barrio o dirección</label>
            <span aria-hidden="true">⌕</span>
            <input id="dv2-search" type="search" autoComplete="off" value={query}
              disabled={!available}
              placeholder="Ciudad, barrio o dirección…" onFocus={() => setFocused(true)}
              onChange={event => { setQuery(event.target.value); setFocused(true); setCandidate(null);setLookupError(""); }}
              onKeyDown={e => { if(e.key==="Escape")setFocused(false);
                if(e.key==="Enter" && matches[0])goArea(matches[0]);
                else if(e.key==="Enter" && cityMatch[0])router.push("/v2/explore/"+cityMatch[0].slug+"?view="+purpose);
              }}/>
          </div>
          <button type="button" className="dv2-report-start" disabled={!available||loading||query.trim().length<4}
            onClick={lookUpAddress}>{loading?"Localizando el lugar…":"Analizar esta dirección →"}</button>
          {!available ? <p role="alert" className="dv2-error">Datos temporalmente inaccesibles. No mostramos resultados de prueba.</p> : null}
          {focused && query.trim().length >= 2 ? <div className="dv2-home-results">
            {cityMatch.map(city=><Link key={city.slug} href={"/v2/explore/"+city.slug+"?view="+purpose} onClick={()=>setFocused(false)}>
              <span><strong>{city.label}</strong><small>Explorar ciudad · datos disponibles</small></span>→
            </Link>)}
            {matches.map(area=><button key={area.id} type="button" onClick={()=>goArea(area)}>
              <span><strong>{area.name}</strong><small>{area.parentName||""} · {area.citySlug==="madrid"?"Madrid":"Londres"}</small></span>→
            </button>)}
            <div className="dv2-address">
              <small>La consulta se envía a OpenStreetMap solo si pulsas este botón. Comprueba el resultado antes de abrirlo.</small>
              {candidate ? <div role="status" className="dv2-verified">
                <small>COINCIDENCIA QUE DEBES CONFIRMAR</small>
                <strong>{candidate.matchedPlace}</strong>
                <span>{candidate.name} · {candidate.citySlug==="madrid"?"Madrid":"Londres"}</span>
                {candidate.locationKind==="broad"
                  ? <Link className="dv2-report-candidate" href={explorer(candidate,purpose)}>
                      Explorar este barrio o ciudad →
                    </Link>
                  : <Link className="dv2-report-candidate" href={locationReportHref({
                      latitude:candidate.latitude,longitude:candidate.longitude,
                      label:candidate.matchedPlace,view:purpose,
                    })}>Confirmar y generar informe de esta ubicación →</Link>}
                <small>Solo se atribuirán datos del barrio oficial, nunca de la calle exacta.</small>
              </div> : null}
              {lookupError ? <p role="alert" className="dv2-error">{lookupError}</p> : null}
            </div>
          </div> : null}
          </div>
          <div className="dv2-quick">
            <span>Empieza explorando:</span>
            <Link href={"/v2/explore/madrid?view="+purpose}>Madrid ↗</Link>
            <Link href={"/v2/explore/london?view="+purpose}>Londres ↗</Link>
            <Link className="dv2-try-report" href={locationReportHref({
              latitude:40.4169,longitude:-3.7034,label:"Puerta del Sol, Madrid",view:purpose,
            })}>Probar un informe real: Puerta del Sol ↗</Link>
          </div>
        </div>
      </div>
    </section>

    <section id="ciudades" className="dv2-container dv2-city-section">
      <div className="dv2-section-head"><div><span className="dv2-eyebrow">NUESTRA COBERTURA</span><h2>Ciudades para investigar<span className="dv2-period">.</span></h2></div>
        <p>Estamos ampliando las fuentes ciudad por ciudad. Las que aún no tienen datos validados aparecen claramente diferenciadas.</p></div>
      <div className="dv2-city-grid">
        {v2Cities.map((city, index)=>{
          const live=city.status==="live";
          const inner=<><div className="dv2-city-card-top"><span>{String(index+1).padStart(2,"0")} / EUROPA</span>
            <span className={live?"dv2-city-status live":"dv2-city-status"}>{live?"DATOS DISPONIBLES":city.status==="source-review"?"FUENTE EN REVISIÓN":"EN ESTUDIO"}</span></div>
            <div><small>{city.country}</small><h3>{city.label}</h3><p>{city.note}</p></div>
            <span className="dv2-city-arrow">{live?"Explorar ciudad ↗":"Sin cifras publicadas todavía"}</span></>;
          return live
            ? <Link className="dv2-city-card dv2-city-active" key={city.slug} href={"/v2/explore/"+city.slug+"?view="+purpose}>{inner}</Link>
            : <article className="dv2-city-card dv2-city-pending" key={city.slug}>{inner}</article>;
        })}
      </div>
    </section>
    <section className="dv2-container dv2-bottom-note"><strong>El objetivo no es colorear Europa.</strong>
      <p>Es ayudarte a decidir con rigor. Cada nueva ciudad necesita una fuente clara, un método verificable y contexto útil. Ninguna zona recibirá una etiqueta por su reputación o por sus habitantes.</p>
      <Link href="/v2/guide">Cómo interpretamos los datos →</Link>
    </section>
  </main>;
}
