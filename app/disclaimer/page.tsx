import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";

async function localeForRequest() {
  const requestHeaders = await headers();
  return localeFromValue(requestHeaders.get("x-datasec-locale"));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await localeForRequest();
  return {
    title: tr(locale, "Data limitations and safety disclaimer", "Limitaciones de datos y aviso de seguridad"),
    description: tr(
      locale,
      "How to interpret dataSec safely: official-source limitations, local comparisons and what the site does not predict.",
      "Cómo interpretar dataSec correctamente: limitaciones de las fuentes oficiales, comparaciones locales y lo que la web no predice.",
    ),
  };
}

export default async function DisclaimerPage() {
  const locale = await localeForRequest();

  return (
    <main className="method-page method-page-clean">
      <Link className="back" href={localeHref(locale, "/")}>
        ← {tr(locale, "Home", "Inicio")}
      </Link>
      <div className="eyebrow">{tr(locale, "Use and limitations", "Uso y limitaciones")}</div>
      <h1>{tr(locale, "Context, not a safety guarantee.", "Contexto, no una garantía de seguridad.")}</h1>
      <p className="method-lead">
        {tr(
          locale,
          "dataSec organises official public records to make local patterns easier to understand. It does not predict whether a particular person will experience crime, harm or any other incident.",
          "dataSec organiza registros públicos oficiales para facilitar la comprensión de patrones locales. No predice si una persona concreta sufrirá un delito, daño u otra incidencia.",
        )}
      </p>

      <section className="method-core">
        <article>
          <span>01</span>
          <div>
            <h2>{tr(locale, "Local comparison only", "Solo comparación local")}</h2>
            <p>
              {tr(
                locale,
                "Resident, Visitor, colour bands, levels and percentiles compare areas inside the same city. Madrid and London use different official source systems and their numbers are not one universal score.",
                "Residente, Visitante, bandas de color, niveles y percentiles comparan zonas dentro de la misma ciudad. Madrid y Londres usan sistemas oficiales distintos y sus cifras no forman una puntuación universal.",
              )}
            </p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>{tr(locale, "Recorded data has limits", "Los datos registrados tienen límites")}</h2>
            <p>
              {tr(
                locale,
                "Official records can be affected by reporting behaviour, anonymised locations, police practices, tourism, nightlife, commuting, source definitions and publication delays.",
                "Los registros oficiales pueden verse afectados por el comportamiento de denuncia, ubicaciones anonimizadas, prácticas policiales, turismo, ocio nocturno, desplazamientos, definiciones de la fuente y retrasos de publicación.",
              )}
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>{tr(locale, "Low does not mean risk-free", "Un nivel bajo no significa riesgo cero")}</h2>
            <p>
              {tr(
                locale,
                "A green area or low relative level can still contain incidents. A red area does not mean that every street or visit is unsafe. The map describes a relative signal, not an individual outcome.",
                "Una zona verde o con nivel relativo bajo puede seguir teniendo incidencias. Una zona roja no significa que cada calle o visita sea insegura. El mapa describe una señal relativa, no un resultado individual.",
              )}
            </p>
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h2>{tr(locale, "Not emergency or professional advice", "No sustituye asesoramiento profesional ni de emergencia")}</h2>
            <p>
              {tr(
                locale,
                "Do not use dataSec instead of official emergency guidance, local authorities, law enforcement, accommodation providers or professional advice when a decision requires current situation-specific information.",
                "No uses dataSec en sustitución de indicaciones oficiales de emergencia, autoridades locales, policía, proveedores de alojamiento o asesoramiento profesional cuando una decisión requiera información actual y específica.",
              )}
            </p>
          </div>
        </article>
      </section>

      <section className="method-limits">
        <div>
          <span>{tr(locale, "TRANSPARENCY", "TRANSPARENCIA")}</span>
          <h2>{tr(locale, "Check the source and status.", "Comprueba la fuente y el estado.")}</h2>
        </div>
        <div>
          <p>
            {tr(
              locale,
              "Each area exposes its source and methodology, and the public status page reports the latest successful publication checks.",
              "Cada zona muestra su fuente y metodología, y la página pública de estado informa de las últimas comprobaciones de publicación correctas.",
            )}
          </p>
          <p>
            <Link href={localeHref(locale, "/methodology")}>
              {tr(locale, "Read the methodology →", "Leer la metodología →")}
            </Link>
            {" · "}
            <Link href={localeHref(locale, "/status")}>
              {tr(locale, "Check data status →", "Comprobar estado de datos →")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
