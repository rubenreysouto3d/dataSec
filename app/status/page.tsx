import Link from "next/link";
import { cityNames, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { headers } from "next/headers";
import { localeFromValue, localeHref, localeTag, tr, type Locale } from "@/lib/i18n";

export const metadata = {
  title: "Data status",
  description: "Latest dataSec publication health check, source freshness and area coverage.",
};

function checkedLabel(value: string | null, locale: Locale) {
  if (!value) return tr(locale, "Not verified in this local build", "No verificado en esta compilación local");
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default async function StatusPage() {
  const requestHeaders = await headers();
  const locale = localeFromValue(requestHeaders.get("x-datasec-locale"));
  return (
    <main className="method-page method-page-clean">
      <Link className="back" href={localeHref(locale, "/")}>← {tr(locale, "Home", "Inicio")}</Link>
      <div className="eyebrow">{tr(locale, "Publication health", "Salud de publicación")}</div>
      <h1>
        {dataHealth.ok
          ? tr(locale, "Data checks passed.", "Comprobaciones de datos superadas.")
          : tr(locale, "Local verification pending.", "Verificación local pendiente.")}
      </h1>
      <p className="method-lead">
        {tr(
          locale,
          "Production is published only after automated checks confirm source freshness, area coverage, map geometry and point lookup for the current datasets.",
          "Producción solo se publica después de que las comprobaciones automáticas confirmen la frescura de la fuente, cobertura de zonas, geometría del mapa y búsqueda por punto.",
        )}
      </p>

      <section className="method-limits">
        <div>
          <span>{tr(locale, "LAST SUCCESSFUL CHECK", "ÚLTIMA COMPROBACIÓN CORRECTA")}</span>
          <h2>{checkedLabel(dataHealth.checkedAt, locale)}</h2>
        </div>
        <div>
          <p>
            {tr(
              locale,
              "A failed health check blocks the build instead of silently publishing stale or incomplete data.",
              "Una comprobación fallida bloquea la compilación en lugar de publicar silenciosamente datos obsoletos o incompletos.",
            )}
          </p>
          <p>{tr(locale, "This page reports the same checks used by the deployment pipeline.", "Esta página muestra las mismas comprobaciones que usa el pipeline de despliegue.")}</p>
        </div>
      </section>

      <section className="method-core">
        {dataHealth.cities.map((city) => (
          <article key={city.city}>
            <span>{city.coverageRatio >= 0.9 ? "OK" : "!"}</span>
            <div>
              <h2>{cityNames[city.city]}</h2>
              <p>
                {tr(locale, "Latest source month:", "Último mes de la fuente:")}{" "}
                <strong>{city.latestMonth ? monthLabel(city.latestMonth, locale) : "—"}</strong>
                {" · "}
                {city.latestMonthCoverage.toLocaleString(localeTag(locale))}{" "}
                {tr(locale, "of", "de")}{" "}
                {city.areaCount.toLocaleString(localeTag(locale))}{" "}
                {tr(locale, "areas covered", "zonas cubiertas")}
                {" · "}
                {(city.coverageRatio * 100).toFixed(1)}% {tr(locale, "coverage", "cobertura")}.
              </p>
            </div>
          </article>
        ))}
      </section>

      <details className="method-technical">
        <summary>
          <span>{tr(locale, "What is checked", "Qué se comprueba")}</span>
          <small>{tr(locale, "Build-blocking validation", "Validación que bloquea la compilación")}</small>
        </summary>
        <div className="method-technical-grid">
          <article>
            <h3>{tr(locale, "Freshness", "Frescura")}</h3>
            <p>{tr(locale, "The latest stored source month must be within the configured freshness window.", "El último mes almacenado de la fuente debe estar dentro de la ventana de frescura configurada.")}</p>
          </article>
          <article>
            <h3>{tr(locale, "Coverage", "Cobertura")}</h3>
            <p>{tr(locale, "At least 90% of active areas must have a valid latest-month context row.", "Al menos el 90% de las zonas activas debe tener una fila válida de contexto del último mes.")}</p>
          </article>
          <article>
            <h3>{tr(locale, "Geometry", "Geometría")}</h3>
            <p>{tr(locale, "Official map-boundary coverage is checked before the public build is allowed to finish.", "La cobertura de límites oficiales del mapa se comprueba antes de permitir que termine la compilación pública.")}</p>
          </article>
          <article>
            <h3>{tr(locale, "Location lookup", "Búsqueda por ubicación")}</h3>
            <p>{tr(locale, "Known points in central London and Madrid must resolve to stable official area IDs.", "Puntos conocidos del centro de Londres y Madrid deben resolverse a IDs oficiales estables de zona.")}</p>
          </article>
        </div>
      </details>

      <p className="density-caution">
        {tr(
          locale,
          "dataSec describes recorded official-source context. It does not predict whether a specific person will experience harm and should not be treated as a guarantee of personal safety.",
          "dataSec describe contexto registrado de fuentes oficiales. No predice si una persona concreta sufrirá daños y no debe tratarse como garantía de seguridad personal.",
        )}
      </p>
    </main>
  );
}
