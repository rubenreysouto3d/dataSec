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

export default function LocationReport({point,area,evidence,indicator,explanation,source}:Props) {
  const relative=bandNumber(evidence.percentile);
  const hasEvidence=evidence.available&&evidence.value!==null;
  const nextView=point.view==="visitor"?"resident":"visitor";
  const lead=!hasEvidence
    ?"Tenemos la ubicación y su zona, pero no suficientes observaciones para leer este indicador con rigor."
    : relative===1
      ?"Los registros disponibles están entre los más bajos de la ciudad para este indicador."
      : relative===2
        ?"Los registros disponibles están por debajo del tramo central de la ciudad."
        : relative===3
          ?"Los registros disponibles están en el tramo central de la ciudad."
          : relative===4
            ?"Los registros disponibles están por encima del tramo central de la ciudad."
            :"Los registros disponibles están entre los más altos de la ciudad para este indicador.";
  const nextStep=point.view==="visitor"
    ?"Úsalo como contexto y comprueba ahora transporte, servicios y la ruta real hasta tu alojamiento."
    :"Úsalo como una señal más y comprueba servicios, transporte y cómo encaja el entorno en tu día a día.";
  return <main className="drep dv2-container" id="location-report">
    <div className="drep-breadcrumbs"><Link href="/v2">Inicio</Link><span>/</span>
      <span>Informe de ubicación</span><span className="drep-beta">VERSIÓN DE PRUEBA</span></div>
    <div className="drep-head">
      <div>
        <p className="drep-eyebrow">DATASEC / INFORME DE UBICACIÓN</p>
        <h1>{point.label}</h1>
        <p className="drep-location-label">{point.view==="visitor"?"Lectura práctica antes de reservar o moverte por aquí.":"Lectura práctica antes de decidir si vivir aquí."}</p>
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

    <section className="drep-verdict" aria-label="Resumen de la ubicación">
      <span>EN 5 SEGUNDOS</span>
      <div><h2>{lead}</h2><p>{nextStep}</p></div>
      <Link href={"/v2/explore/"+area.citySlug+"?view="+point.view+"&area="+encodeURIComponent(area.id)}>
        Ver esta zona en el mapa <span aria-hidden="true">↗</span>
      </Link>
    </section>

    <div className="drep-layout">
      <div className="drep-content">
        <NearbyServices point={point}/>
        <div className="drep-question drep-question-after-nearby">
          <span>QUÉ RESPALDA ESA LECTURA</span>
          <h2>{point.view==="visitor"?"Datos de la zona, después el entorno real.":"Datos de la zona, después tu vida diaria."}</h2>
          <p>El punto está localizado dentro de una zona oficial. Sus registros describen esa zona,
            <strong> no tu calle ni el edificio concreto.</strong></p>
        </div>
        <section className="drep-reading" aria-labelledby="drep-evidence-title">
          <div className="drep-section-top"><span>02 / DATOS DE LA ZONA</span>
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
          <p>Usa los datos de zona como contexto y el entorno inmediato para entender mejor este lugar.
            Este informe no certifica seguridad ni calidad de vida.</p>
          <Link href={"/v2/explore/"+area.citySlug+"?view="+point.view+"&area="+encodeURIComponent(area.id)}>Explorar esta zona →</Link>
          <Link href="/v2">Buscar otro lugar →</Link>
          <Link href="/v2/saved">Mis lugares guardados →</Link>
          <Link href={choiceHref(point,null,point.view)}>Tengo dos sitios concretos que valorar →</Link>
        </div>
      </aside>
    </div>
  </main>;
}
