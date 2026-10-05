import Link from "next/link";
import { getCitySnapshot, getNeighbourhoods, monthLabel, type CitySlug } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { localeFromValue, localeHref, localeTag, tr } from "@/lib/i18n";
import "./home-gateway.css";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let available = true;

  try {
    areas = await getNeighbourhoods();
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    available = false;
  }

  const cityRows = await Promise.all((["madrid","london"] as CitySlug[]).map(async slug => {
    const ids=areas.filter(area=>area.citySlug===slug).map(area=>area.id);
    const snapshot=available?await getCitySnapshot(slug,ids):null;
    return {slug,count:ids.length,snapshot};
  }));

  const checkedLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(dataHealth.checkedAt))
    : tr(locale, "pending", "pendiente");

  return <main className="web-index" id="main-content">
    <section className="web-index-hero">
      <span className="web-index-kicker">DATASEC / URBAN CONTEXT</span>
      <h1>{tr(locale,
        "Know what kind of place you're looking at.",
        "Entiende qué tipo de sitio estás mirando.")}</h1>
      <p>{tr(locale,
        "DataSec separates recorded incidents, recent change, urban activity and local context instead of compressing a neighbourhood into one safety score.",
        "DataSec separa incidencias registradas, cambio reciente, actividad urbana y contexto local en vez de comprimir un barrio en una nota de seguridad.")}</p>
      <div className="web-index-actions">
        <Link className="web-index-primary" href={localeHref(locale,"/v2")}>
          {tr(locale,"Open the live tool","Abrir la herramienta")} ↗
        </Link>
        <Link href={localeHref(locale,"/city/madrid/trends")}>
          {tr(locale,"See recent changes","Ver cambios recientes")} →
        </Link>
      </div>
    </section>

    <section className="web-index-cities" aria-label={tr(locale,"Cities","Ciudades")}>
      {cityRows.map(({slug,count,snapshot})=>{
        const label=slug==="madrid"?"Madrid":"London";
        return <article key={slug} className="web-index-city">
          <header>
            <span>{slug==="madrid"?"01":"02"} / 02</span>
            <small>{snapshot?monthLabel(snapshot.month,locale):"—"}</small>
          </header>
          <h2>{label}</h2>
          <p>{count.toLocaleString(localeTag(locale))} {tr(locale,"mapped areas","zonas cartografiadas")}</p>
          <nav>
            <Link href={localeHref(locale,`/v2/explore/${slug}?view=visitor`)}>
              <strong>{tr(locale,"Investigate on the map","Investigar en el mapa")}</strong>
              <span>↗</span>
            </Link>
            <Link href={localeHref(locale,`/city/${slug}/trends`)}>
              <strong>{tr(locale,"What changed recently","Qué ha cambiado")}</strong>
              <span>→</span>
            </Link>
            <Link href={localeHref(locale,`/city/${slug}/resident`)}>
              <strong>{tr(locale,"Context for living there","Contexto para vivir")}</strong>
              <span>→</span>
            </Link>
            <Link href={localeHref(locale,`/city/${slug}/visitor`)}>
              <strong>{tr(locale,"Context for visiting","Contexto para visitar")}</strong>
              <span>→</span>
            </Link>
          </nav>
        </article>;
      })}
    </section>

    <section className="web-index-paths">
      <div>
        <span>01</span>
        <strong>{tr(locale,"I have a specific address","Tengo una dirección concreta")}</strong>
        <p>{tr(locale,"Open the tool, locate the point and inspect its area plus nearby services.",
          "Abre la herramienta, sitúa el punto y mira su zona y lo que tiene alrededor.")}</p>
        <Link href={localeHref(locale,"/v2")}>{tr(locale,"Open search","Abrir búsqueda")} →</Link>
      </div>
      <div>
        <span>02</span>
        <strong>{tr(locale,"I don't know the city","No conozco la ciudad")}</strong>
        <p>{tr(locale,"Start with recent changes and the city map instead of choosing from a static ranking.",
          "Empieza por los cambios recientes y el mapa de ciudad, no por un ranking estático.")}</p>
        <Link href={localeHref(locale,"/city/madrid/trends")}>{tr(locale,"Explore city changes","Explorar cambios")} →</Link>
      </div>
      <div>
        <span>03</span>
        <strong>{tr(locale,"I want to know what the data actually means","Quiero saber qué significan los datos")}</strong>
        <p>{tr(locale,"Each layer keeps its source, period and limits visible.",
          "Cada capa mantiene visible su fuente, período y límites.")}</p>
        <Link href={localeHref(locale,"/methodology")}>{tr(locale,"Methodology","Metodología")} →</Link>
      </div>
    </section>

    <div className="web-index-status">
      <span>{tr(locale,"Last data check","Última comprobación")}: {checkedLabel}</span>
      {!available?<strong>{tr(locale,"Stored data is temporarily unavailable.","Los datos almacenados no están disponibles temporalmente.")}</strong>:null}
    </div>
  </main>;
}
