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
    title: tr(locale, "Methodology", "Metodología"),
    description: tr(
      locale,
      "How dataSec turns official neighbourhood-level public-safety data into consistent Resident and Visitor views without pretending unlike city sources are identical.",
      "Cómo convierte dataSec datos oficiales de seguridad por barrio en vistas coherentes para Residentes y Visitantes sin fingir que fuentes urbanas distintas son idénticas.",
    ),
  };
}

export default async function MethodologyPage() {
  const locale = await localeForRequest();

  return (
    <main className="method-page method-page-clean">
      <div className="eyebrow">{tr(locale, "How dataSec works", "Cómo funciona dataSec")}</div>
      <h1>
        {tr(
          locale,
          "One product language. Different official city sources.",
          "Un lenguaje de producto. Distintas fuentes oficiales por ciudad.",
        )}
      </h1>
      <p className="method-lead">
        {tr(
          locale,
          "dataSec keeps the interface consistent across cities while documenting the differences in what each official source actually measures.",
          "dataSec mantiene una interfaz coherente entre ciudades y documenta las diferencias de lo que mide realmente cada fuente oficial.",
        )}
      </p>

      <section className="method-core">
        <article>
          <span>01</span>
          <div>
            <h2>{tr(locale, "Official data first", "Primero, datos oficiales")}</h2>
            <p>
              {tr(
                locale,
                "London uses UK Police open data. Madrid uses Madrid Municipal Police dispatch data. Every snapshot is stored with its source, date and geographic boundary.",
                "Londres usa datos abiertos de UK Police. Madrid usa datos de incidencias de Policía Municipal. Cada captura se almacena con su fuente, fecha y límite geográfico.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>02</span>
          <div>
            <h2>{tr(locale, "Resident and Visitor everywhere", "Residente y Visitante en todas partes")}</h2>
            <p>
              {tr(
                locale,
                "Every city exposes the same two primary views. Resident focuses on recurring residential exposure; Visitor focuses on short-stay street exposure, especially theft and robbery.",
                "Cada ciudad ofrece las mismas dos vistas principales. Residente se centra en el contexto residencial recurrente; Visitante en la exposición de una estancia corta, especialmente hurtos y robos.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>03</span>
          <div>
            <h2>{tr(locale, "Local scale, two ways to read it", "Escala local, dos formas de leerla")}</h2>
            <p>
              {tr(
                locale,
                "Colours are relative within the same city and are also encoded as levels 1–5 for accessibility. Green/1 means a lower local signal; red/5 means a higher local signal. Neither is a guarantee or verdict.",
                "Los colores son relativos dentro de la misma ciudad y también se codifican como niveles 1–5 por accesibilidad. Verde/1 significa una señal local menor; rojo/5 una mayor. Ninguno es una garantía ni un veredicto.",
              )}
            </p>
          </div>
        </article>

        <article>
          <span>04</span>
          <div>
            <h2>{tr(locale, "Comparable interface, honest methods", "Interfaz comparable, métodos honestos")}</h2>
            <p>
              {tr(
                locale,
                "The filters are identical across cities, but the documented official implementation behind each filter can differ. Percentiles compare areas only inside their own city; dataSec does not create a fake Europe-wide ranking from unlike datasets.",
                "Los filtros son idénticos entre ciudades, pero la implementación oficial documentada detrás de cada filtro puede diferir. Los percentiles comparan zonas solo dentro de su propia ciudad; dataSec no crea un ranking europeo falso a partir de conjuntos incompatibles.",
              )}
            </p>
          </div>
        </article>
      </section>

      <section className="method-limits">
        <div>
          <span>{tr(locale, "IMPORTANT", "IMPORTANTE")}</span>
          <h2>{tr(locale, "What the map does not mean", "Lo que el mapa no significa")}</h2>
        </div>
        <div>
          <p>{tr(locale, "Recorded incidents are not identical to personal risk or underlying victimisation.", "Las incidencias registradas no equivalen al riesgo personal ni a la victimización subyacente.")}</p>
          <p>{tr(locale, "Central areas can appear high because of tourism, nightlife, transport and footfall.", "Las zonas centrales pueden aparecer altas por turismo, ocio nocturno, transporte y afluencia.")}</p>
          <p>{tr(locale, "Resident denominators do not count visitors or commuters.", "Los denominadores de residentes no cuentan visitantes ni población flotante.")}</p>
          <p>{tr(locale, "Perception data, where used, is clearly identified and kept separate from incident records.", "Los datos de percepción, cuando se usan, se identifican claramente y se mantienen separados de los registros de incidencias.")}</p>
          <p>{tr(locale, "Resident and Visitor percentiles from different cities must not be compared as if they shared one universal score.", "Los percentiles de Residente y Visitante de distintas ciudades no deben compararse como si compartieran una puntuación universal.")}</p>
        </div>
      </section>

      <details className="method-technical">
        <summary>
          <span>{tr(locale, "Technical methodology", "Metodología técnica")}</span>
          <small>{tr(locale, "Validation, geography, ingestion and health checks", "Validación, geografía, ingestión y controles de salud")}</small>
        </summary>
        <div className="method-technical-grid">
          <article>
            <h3>{tr(locale, "Source validation", "Validación de fuentes")}</h3>
            <p>{tr(locale, "Expected fields, category mappings, geography and unmatched-row thresholds are checked before observations are published.", "Los campos esperados, mapeos de categorías, geografía y umbrales de filas sin correspondencia se comprueban antes de publicar observaciones.")}</p>
          </article>
          <article>
            <h3>{tr(locale, "Geography", "Geografía")}</h3>
            <p>{tr(locale, "Official area boundaries are stored and used for lookup and local comparison instead of relying on geocoder labels alone.", "Se almacenan límites oficiales de zona y se usan para búsquedas y comparaciones locales, en lugar de depender solo de etiquetas de geocodificación.")}</p>
          </article>
          <article>
            <h3>{tr(locale, "Publication health", "Salud de publicación")}</h3>
            <p>
              {tr(locale, "Coverage, freshness, map geometry and core public-data queries are checked automatically before deployment.", "La cobertura, frescura, geometría del mapa y consultas públicas principales se comprueban automáticamente antes del despliegue.")}{" "}
              <Link href={localeHref(locale, "/status")}>
                {tr(locale, "See the latest public status check →", "Ver el último estado público →")}
              </Link>
            </p>
          </article>
          <article>
            <h3>{tr(locale, "Shared categories", "Categorías compartidas")}</h3>
            <p>{tr(locale, "Source-specific police labels are mapped into a common user-facing vocabulary. Non-crime responses such as emergency assistance or traffic are kept separate from safety-related categories.", "Las etiquetas policiales específicas de cada fuente se mapean a un vocabulario común para el usuario. Respuestas no delictivas como asistencia de emergencia o tráfico se mantienen separadas de las categorías de seguridad.")}</p>
          </article>
        </div>
      </details>
    </main>
  );
}
