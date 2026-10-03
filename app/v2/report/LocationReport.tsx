import Link from "next/link";
import type { AreaProfile } from "@/lib/data";
import type { PlaceEvidence } from "@/lib/place-evidence";
import type { ReportPoint } from "@/lib/location-report";
import { locationReportHref } from "@/lib/location-report";
import { choiceHref } from "@/lib/address-choice";
import { bandNumber } from "@/lib/map-view";
import { NearbyServices, ReportMap, ReportSave, ReportShare } from "./ReportActions";
import "./report.css";

type Alternative = { id:string;name:string;period:string|null;value:number|null;available:boolean };
type Props = {
  point:ReportPoint;
  area:AreaProfile;
  evidence:PlaceEvidence;
  indicator:string;
  explanation:string;
  source:{label:string;url:string;note:string};
  alternatives:Alternative[];
};
const cityName = (city:"madrid"|"london")=>city==="madrid"?"Madrid":"Londres";
function number(value:number|null) {
  return value===null?"—":new Intl.NumberFormat("es-ES",{maximumFractionDigits:1}).format(value);
}
const bandCopy = [
  "Entre los registros más bajos de esta ciudad",
  "Registros por debajo del tramo central",
  "Registros en el tramo central de la ciudad",
  "Registros por encima del tramo central",
  "Entre los registros más altos de esta ciudad",
];

export default function LocationReport({point,area,evidence,indicator,explanation,source,alternatives}:Props) {
  const purpose=point.view==="visitor"?"tu visita":"tu posible mudanza";
  const relative=bandNumber(evidence.percentile);
  const hasEvidence=evidence.available&&evidence.value!==null;
  const nextView=point.view==="visitor"?"resident":"visitor";
  return <main className="drep dv2-container" id="location-report">
    <div className="drep-breadcrumbs"><Link href="/v2">Inicio</Link><span>/</span>
      <span>Informe de ubicación</span><span className="drep-beta">VERSIÓN DE PRUEBA</span></div>
    <div className="drep-head">
      <div>
        <p className="drep-eyebrow">DATASEC / INFORME DE UBICACIÓN</p>
        <h1>Antes de decidir,<br/><em>conoce este lugar.</em></h1>
        <p className="drep-location-label">{point.label}</p>
        <p className="drep-actual-zone">Ubicación geocodificada en <strong>{area.name}</strong>
          {area.parentName?" · "+area.parentName:""} · {cityName(area.citySlug)}</p>
      </div>
      <div className="drep-controls" aria-label="Acciones del informe">
        <div className="drep-audience" role="group" aria-label="Objetivo">
          <Link aria-current={point.view==="visitor"?"page":undefined}
            href={locationReportHref({...point,view:"visitor"})}>Voy de viaje</Link>
          <Link aria-current={point.view==="resident"?"page":undefined}
            href={locationReportHref({...point,view:"resident"})}>Quiero vivir aquí</Link>
        </div>
        <div className="drep-quick-actions">
          <ReportSave point={point} areaId={area.id} city={area.citySlug}/>
          <ReportShare point={point}/>
        </div>
      </div>
    </div>

    <div className="drep-layout">
      <div className="drep-content">
        <div className="drep-question">
          <span>LO PRIMERO QUE NECESITAS SABER</span>
          <h2>{point.view==="visitor"?"¿Qué sabemos del entorno de tu alojamiento?":"¿Qué podemos comprobar antes de mudarte?"}</h2>
          <p>Hemos localizado tu punto en una zona oficial. Los datos disponibles describen esa zona,
            <strong> no tu calle ni el edificio concreto.</strong></p>
        </div>
        <section className="drep-reading" aria-labelledby="drep-evidence-title">
          <div className="drep-section-top"><span>01 / DATOS CONTRASTABLES</span>
            <span>{evidence.period??"SIN PERÍODO DISPONIBLE"}</span></div>
          <h2 id="drep-evidence-title">{indicator}</h2>
          {hasEvidence?<>
            <div className="drep-figure"><strong>{number(evidence.value)}</strong>
              <span>{point.view==="visitor"?"registros seleccionados / km²":
                evidence.indicator==="personal-harm"?"incidencias seleccionadas / 10.000 residentes / mes":
                "registros seleccionados / 10.000 residentes"}</span></div>
            <p className="drep-relative">{relative?bandCopy[relative-1]:"Sin posición relativa"}
              <span>Comparación del indicador exclusivamente dentro de {cityName(area.citySlug)}.</span></p>
          </>:<div className="drep-missing">No hay observaciones suficientes de este indicador para esta zona.
            No interpretamos la ausencia de registros como ausencia de incidentes.</div>}
          <div className="drep-meaning">
            <h3>¿Cómo interpreto esto?</h3>
            <p>{explanation}</p>
            {point.view==="visitor"&&<p>Un área con mucha actividad turística puede registrar
              más incidentes por superficie. No contamos con una tasa fiable de incidentes por visitante.</p>}
            {point.view==="resident"&&<p>La reputación histórica de un barrio y las características
              socioeconómicas de sus habitantes no sustituyen la información actual.</p>}
          </div>
          <div className="drep-source"><span>{source.label}</span>
            <a href={source.url} target="_blank" rel="noopener noreferrer">Consultar fuente ↗</a></div>
          <small className="drep-detail">{source.note} La localización buscada se asocia a la zona administrativa:
            no se atribuyen estos registros a la dirección concreta.</small>
        </section>

        <NearbyServices point={point}/>

        <section className="drep-caution">
          <div><span className="drep-eyebrow">03 / PRECISIÓN REAL</span>
            <h2>¿Y las calles de alrededor?</h2></div>
          <div>
            <strong>No hay una lista de calles que evitar verificada para este punto.</strong>
            <p>{area.citySlug==="london"?
              "La fuente policial británica anonimiza las ubicaciones de los delitos publicados; no podemos atribuirlos a calles o portales exactos.":
              "La serie municipal que tenemos integrada permite contextualizar el barrio, pero no ofrece evidencias suficientes para señalar calles concretas alrededor de este punto."}
              {" "}No convertiríamos una reputación o un dato sin resolución suficiente en una advertencia.</p>
          </div>
        </section>

        {alternatives.length>0&&<section className="drep-alternatives">
          <div className="drep-section-top"><span>04 / ALTERNATIVAS</span><span>{area.parentName||"MISMA GEOGRAFÍA"}</span></div>
          <h2>Contrasta otras zonas del mismo distrito</h2>
          <p>Es el mismo indicador dentro de {cityName(area.citySlug)}.
            Compara cifras solo cuando coincida también el período observado.</p>
          <div className="drep-alt-list">{alternatives.slice(0,5).map(a=>{
            const samePeriod=hasEvidence&&a.available&&a.period===evidence.period;
            return <div className="drep-alt" key={a.id}>
              <div><strong>{a.name}</strong><small>{samePeriod?"Mismo indicador y período":
                a.available?"Otro período: comparación temporal limitada":"Sin observaciones suficientes"}</small></div>
              <div className="drep-alt-right">
                <span>{samePeriod?number(a.value):"—"}</span>
                <Link href={"/v2/explore/"+area.citySlug+"?view="+point.view+"&area="+encodeURIComponent(a.id)}>
                  Ver ficha ↗</Link>
              </div>
            </div>;
          })}</div>
          <Link className="drep-secondary-link" href={"/v2/explore/"+area.citySlug+"?view="+point.view+
            "&area="+encodeURIComponent(area.id)}>Abrir el explorador de barrios →</Link>
        </section>}
      </div>

      <aside className="drep-aside">
        <div className="drep-aside-card">
          <span className="drep-eyebrow">TU UBICACIÓN</span>
          <ReportMap point={point}/>
          <dl>
            <div><dt>Zona comprobada</dt><dd>{area.name}</dd></div>
            <div><dt>Ámbito</dt><dd>{area.parentName||cityName(area.citySlug)}</dd></div>
            <div><dt>Período de datos</dt><dd>{evidence.period||"No disponible"}</dd></div>
            <div><dt>Exactitud</dt><dd>Indicadores de barrio, no de portal</dd></div>
          </dl>
          <Link href={locationReportHref({...point,view:nextView})} className="drep-switch-intent">
            Ver informe para {nextView==="visitor"?"viajar":"vivir"} ↗</Link>
        </div>
        <div className="drep-next">
          <strong>¿Qué decisión puedes tomar?</strong>
          <p>Contrasta ubicaciones, servicios y fuentes antes de {purpose}.
            Este informe no certifica seguridad ni calidad de vida.</p>
          <Link href="/v2">Investigar otra dirección →</Link>
          <Link href="/v2/saved">Mis ubicaciones guardadas →</Link>
        </div>
      </aside>
    </div>
  </main>;
}
