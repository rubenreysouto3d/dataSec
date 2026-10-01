import Link from "next/link";
import { getCitySnapshot, getNeighbourhoods, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { localeFromValue, localeHref, localeTag, tr } from "@/lib/i18n";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let londonSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let madridSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let error = false;

  try {
    areas = await getNeighbourhoods();
    const londonIds = areas.filter((area) => area.citySlug === "london").map((area) => area.id);
    const madridIds = areas.filter((area) => area.citySlug === "madrid").map((area) => area.id);
    [londonSnapshot, madridSnapshot] = await Promise.all([
      getCitySnapshot("london", londonIds),
      getCitySnapshot("madrid", madridIds),
    ]);
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  const cityCards = [
    { slug: "madrid", name: "Madrid", snapshot: madridSnapshot, count: areas.filter((area) => area.citySlug === "madrid").length },
    { slug: "london", name: "London", snapshot: londonSnapshot, count: areas.filter((area) => area.citySlug === "london").length },
  ] as const;

  const checkedLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(dataHealth.checkedAt))
    : tr(locale, "pending", "pendiente");

  return (
    <main className="data-home">
      <section className="data-home-hero" aria-labelledby="home-title">
        <div className="data-home-lead">
          <span className="data-kicker">{tr(locale, "Explore your city with context", "Explora tu ciudad con contexto")}</span>
          <h1 id="home-title">
            {tr(locale, "Know the area.", "Conoce la zona.")}
            <br />
            <span>{tr(locale, "See beyond the colour.", "Mira más allá del color.")}</span>
          </h1>
          <p>{tr(locale,
            "Explore official neighbourhood-level records in a map designed for the questions residents and visitors actually ask.",
            "Explora registros oficiales por barrios en un mapa pensado para las preguntas reales de residentes y visitantes.",
          )}</p>
          <a className="data-home-jump" href="#areas">
            {tr(locale, "Explore a city", "Explorar una ciudad")} <span aria-hidden="true">↓</span>
          </a>
        </div>
        <aside className="data-home-principle">
          <span className="data-kicker">{tr(locale, "How to interpret it", "Cómo interpretarlo")}</span>
          <strong>{tr(locale, "Local patterns, not personal-risk predictions.", "Patrones locales, no predicciones de riesgo personal.")}</strong>
          <p>{tr(locale,
            "Colours describe relative differences within each city. Sources and methods vary, so Madrid and London do not share a universal safety score.",
            "Los colores describen diferencias relativas dentro de cada ciudad. Las fuentes y los métodos varían: Madrid y Londres no comparten una puntuación universal de seguridad.",
          )}</p>
          <Link href={localeHref(locale, "/methodology")}>
            {tr(locale, "Explore the methodology", "Consulta la metodología")} <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </section>

      <section className="data-home-cities" id="areas" aria-labelledby="data-cities-title">
        <div className="data-section-heading">
          <div>
            <span className="data-kicker">{tr(locale, "Start here", "Empieza aquí")}</span>
            <h2 id="data-cities-title">{tr(locale, "Choose a city", "Elige una ciudad")}</h2>
          </div>
          <p>{tr(locale, "Then choose whether you're exploring a place to live or a short stay.", "Después elige si buscas dónde vivir o preparar una estancia corta.")}</p>
        </div>
        {error ? (
          <div className="notice" role="status">
            {tr(locale, "The validated data store is temporarily unavailable.", "El almacén de datos validados no está disponible temporalmente.")}
          </div>
        ) : (
          <div className="data-city-grid">
            {cityCards.map((city, index) => (
              <article className="data-city-card" key={city.slug}>
                <div className="data-city-overline">
                  <span>0{index + 1} / 02</span>
                  <span>{tr(locale, "Official local data", "Datos locales oficiales")}</span>
                </div>
                <h3><Link href={localeHref(locale, `/city/${city.slug}`)}>{city.name} <span aria-hidden="true">↗</span></Link></h3>
                <div className="data-city-stats">
                  <div>
                    <span>{tr(locale, "Areas covered", "Zonas disponibles")}</span>
                    <strong>{city.count.toLocaleString(localeTag(locale))}</strong>
                  </div>
                  <div>
                    <span>{tr(locale, "Latest source month", "Último mes de la fuente")}</span>
                    <strong>{city.snapshot ? monthLabel(city.snapshot.month, locale) : "—"}</strong>
                  </div>
                </div>
                <div className="data-city-actions">
                  <Link href={localeHref(locale, `/city/${city.slug}?view=resident`)}>
                    <span>{tr(locale, "I live here", "Quiero vivir aquí")}</span>
                    <strong>{tr(locale, "Resident view", "Vista residente")}</strong>
                    <span aria-hidden="true">↗</span>
                  </Link>
                  <Link href={localeHref(locale, `/city/${city.slug}?view=visitor`)}>
                    <span>{tr(locale, "I'm visiting", "Voy de visita")}</span>
                    <strong>{tr(locale, "Visitor view", "Vista visitante")}</strong>
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="data-home-guide" aria-labelledby="guide-title">
        <div className="data-home-guide-copy">
          <span className="data-kicker">{tr(locale, "Read the map", "Lee el mapa")}</span>
          <h2 id="guide-title">{tr(locale, "A comparison, not a verdict.", "Una comparación, no un veredicto.")}</h2>
          <p>{tr(locale,
            "Five levels show where the selected indicator is lower or higher than in other areas of the same city. Select a neighbourhood for its figures, date and context.",
            "Cinco niveles muestran dónde el indicador elegido es menor o mayor que en otras zonas de la misma ciudad. Selecciona un barrio para ver sus cifras, fecha y contexto.",
          )}</p>
        </div>
        <div className="data-scale-explainer" aria-label={tr(locale, "Five relative map levels", "Cinco niveles relativos del mapa")}>
          <div className="data-scale-caption">
            <span>{tr(locale, "Lower relative signal", "Señal relativa menor")}</span>
            <span>{tr(locale, "Higher relative signal", "Señal relativa mayor")}</span>
          </div>
          <div className="data-scale-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="data-scale-numbers" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
          <small>{tr(locale, "Compared within each city · no data appears uncoloured", "Comparación dentro de cada ciudad · los datos ausentes aparecen sin color")}</small>
        </div>
      </section>

      <div className="data-home-foot">
        <span>{tr(locale, "Last data check", "Última comprobación de datos")}: <strong>{checkedLabel}</strong></span>
        <Link href={localeHref(locale, "/status")}>{tr(locale, "Source status", "Estado de las fuentes")} ↗</Link>
        <Link href={localeHref(locale, "/disclaimer")}>{tr(locale, "Important limitations", "Limitaciones importantes")} ↗</Link>
      </div>
    </main>
  );
}
