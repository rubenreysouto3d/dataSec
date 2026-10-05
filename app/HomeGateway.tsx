import Link from "next/link";
import { localeHref, tr, type Locale } from "@/lib/i18n";
import type { CitySlug } from "@/lib/data";

type PulseRow={areaId:string;name:string;change:number};
type CityPulse={
  slug:CitySlug;
  count:number;
  period:string|null;
  rising:PulseRow[];
  falling:PulseRow[];
  comparable:boolean;
};
type Props={
  locale:Locale;
  pulses:CityPulse[];
  checkedLabel:string;
  available:boolean;
};

function cityName(slug:CitySlug){return slug==="madrid"?"Madrid":"London";}
function signed(value:number){
  return (value>0?"+":"")+new Intl.NumberFormat("es-ES",{maximumFractionDigits:0}).format(value)+"%";
}

export default function HomeGateway({locale,pulses,checkedLabel,available}:Props){
  return <main className="intel-home" id="main-content">
    <section className="intel-intro">
      <div className="intel-intro-main">
        <span className="intel-kicker">DATASEC / URBAN CONTEXT</span>
        <h1>{tr(locale,"Know the place. Then use the map.","Entiende el lugar. Luego usa el mapa.")}</h1>
        <p>{tr(locale,
          "A public reading of what is changing in the cities we cover. The application is the working tool: search a place, use your location and inspect nearby street or area signals.",
          "La web pública muestra qué está cambiando en las ciudades cubiertas. La aplicación es la herramienta de trabajo: busca un sitio, usa tu ubicación y consulta señales cercanas de calle o zona."
        )}</p>
      </div>
      <div className="intel-launch">
        <span>{tr(locale,"IN THE STREET","EN EL SITIO")}</span>
        <strong>{tr(locale,"Open the live map","Abrir el mapa de uso")}</strong>
        <p>{tr(locale,
          "Nearby context, practical services and street-level police signals where the source actually supports them.",
          "Contexto cercano, servicios útiles y señales policiales de calle solo donde la fuente permite esa precisión."
        )}</p>
        <Link href="/v2">{tr(locale,"Open DataSec app →","Abrir DataSec →")}</Link>
      </div>
    </section>

    <section className="intel-cities" aria-labelledby="intel-cities-title">
      <div className="intel-section-head">
        <div>
          <span className="intel-kicker">{tr(locale,"CITY PULSE","PULSO DE CIUDAD")}</span>
          <h2 id="intel-cities-title">{tr(locale,"What changed recently?","¿Qué ha cambiado recientemente?")}</h2>
        </div>
        <small>{tr(locale,"Last data check","Última comprobación")}: {checkedLabel}</small>
      </div>

      {!available?<p className="intel-error">{tr(locale,
        "The stored dataset is temporarily unavailable.",
        "Los datos almacenados no están disponibles temporalmente."
      )}</p>:null}

      <div className="intel-city-stack">
        {pulses.map(city=><article className="intel-city" key={city.slug}>
          <header>
            <div>
              <span>{city.count} {tr(locale,"mapped areas","zonas cartografiadas")}</span>
              <h3>{cityName(city.slug)}</h3>
            </div>
            <div className="intel-city-meta">
              <span>{tr(locale,"LATEST SOURCE","ÚLTIMA FUENTE")}</span>
              <strong>{city.period||"—"}</strong>
            </div>
          </header>

          <div className="intel-city-body">
            <section>
              <div className="intel-list-title">
                <span>{tr(locale,"RECENT RISES","SUBIDAS RECIENTES")}</span>
                <small>{tr(locale,"latest 3 months vs previous 3","últimos 3 meses vs 3 anteriores")}</small>
              </div>
              {city.rising.length?city.rising.map(row=><Link
                href={"/v2/explore/"+city.slug+"?view=visitor&area="+encodeURIComponent(row.areaId)}
                className="intel-row" key={row.areaId}>
                <strong>{row.name}</strong><b>{signed(row.change)}</b>
              </Link>):<p className="intel-no-data">{city.comparable
                ?tr(locale,"No material rise in this window.","Sin subidas materiales en esta ventana.")
                :tr(locale,"Not enough comparable history yet.","Aún no hay historial comparable suficiente.")}</p>}
            </section>

            <section>
              <div className="intel-list-title">
                <span>{tr(locale,"RECENT FALLS","BAJADAS RECIENTES")}</span>
                <small>{tr(locale,"same official signal","misma señal oficial")}</small>
              </div>
              {city.falling.length?city.falling.map(row=><Link
                href={"/v2/explore/"+city.slug+"?view=visitor&area="+encodeURIComponent(row.areaId)}
                className="intel-row" key={row.areaId}>
                <strong>{row.name}</strong><b>{signed(row.change)}</b>
              </Link>):<p className="intel-no-data">{city.comparable
                ?tr(locale,"No material fall in this window.","Sin bajadas materiales en esta ventana.")
                :tr(locale,"Not enough comparable history yet.","Aún no hay historial comparable suficiente.")}</p>}
            </section>

            <aside className="intel-city-use">
              <span>{tr(locale,"USE IT","ÚSALO")}</span>
              <p>{city.slug==="london"
                ?tr(locale,
                  "London currently supports approximate street-level crime locations. In the app you can inspect nearby theft/robbery, drugs, disorder and violence signals.",
                  "Londres permite ahora ubicaciones policiales aproximadas a nivel de calle. En la app puedes consultar focos cercanos de hurtos/robos, drogas, desorden y violencia."
                )
                :tr(locale,
                  "Madrid's current official source does not support street-level precision. DataSec keeps the reading at neighbourhood level instead of inventing exact hotspots.",
                  "La fuente oficial actual de Madrid no permite precisión de calle. DataSec mantiene la lectura a nivel de barrio en vez de inventar focos exactos."
                )}</p>
              <Link href={"/v2/explore/"+city.slug+"?view=visitor"}>{tr(locale,"Open app map →","Abrir mapa en la app →")}</Link>
            </aside>
          </div>

          <footer>
            <Link href={localeHref(locale,"/city/"+city.slug)}>{tr(locale,"Public city data","Datos públicos de la ciudad")} ↗</Link>
            <Link href={localeHref(locale,"/city/"+city.slug+"/trends")}>{tr(locale,"See the full trend","Ver tendencia completa")} ↗</Link>
          </footer>
        </article>)}
      </div>
    </section>

    <section className="intel-principle">
      <span className="intel-kicker">{tr(locale,"HOW DATASEC SHOULD HELP","PARA QUÉ DEBE SERVIR DATASEC")}</span>
      <div>
        <strong>{tr(locale,"Before you go","Antes de ir")}</strong>
        <p>{tr(locale,"Understand a neighbourhood, recent change and the limits of the available evidence.","Entender un barrio, su cambio reciente y los límites de la evidencia disponible.")}</p>
      </div>
      <div>
        <strong>{tr(locale,"While you are there","Cuando ya estás allí")}</strong>
        <p>{tr(locale,"See what is around you and which nearby points deserve more attention, without pretending monthly records are real-time alerts.","Ver qué tienes alrededor y qué puntos cercanos merecen más atención, sin fingir que los registros mensuales son alertas en tiempo real.")}</p>
      </div>
    </section>
  </main>;
}
