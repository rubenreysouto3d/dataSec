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
                "Every city exposes two views, but each represents identifiable source measurements rather than measured personal exposure: resident-normalised incidents and theft/robbery-related concentration.",
                "Cada ciudad tiene dos vistas, pero ambas representan registros identificables de sus fuentes, no exposición personal medida: incidencias normalizadas por residentes y concentración de categorías relacionadas con hurtos y robos.",
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

      <section className="method-source-methods" aria-labelledby="source-methods-heading">
        <span className="data-kicker">{tr(locale, "Behind the colours", "Qué hay detrás de los colores")}</span>
        <h2 id="source-methods-heading">{tr(locale, "Two views. Two observable indicators.", "Dos vistas. Dos indicadores observables.")}</h2>
        <p>{tr(locale,
          "Colour bands describe the rank of a recorded indicator against areas in the same city. Neither view measures your likelihood of experiencing crime.",
          "Los colores representan la posición de un indicador registrado frente a otras zonas de la misma ciudad. Ninguna vista mide tu probabilidad de sufrir un delito.",
        )}</p>
        <div className="method-source-cards">
          <article>
            <h3>{tr(locale, "Resident: recorded incidents per resident", "Residente: incidencias registradas por habitante")}</h3>
            <p>{tr(locale,
              "Madrid: selected personal-harm-related police-dispatch categories averaged over available recent months per 10,000 registered residents per month. London: latest-month recorded violence/property categories per 10,000 people using the 2021 Census.",
              "Madrid: categorías seleccionadas de incidencias policiales relacionadas con daño personal promediadas durante los meses recientes disponibles por 10.000 residentes empadronados y mes. Londres: categorías registradas de violencia y propiedad del último mes por 10.000 habitantes según el censo de 2021.",
            )}</p>
            <p>{tr(locale,
              "Madrid's 2025 district-level survey is independent context alongside the recorded signal. It does not influence the map colour.",
              "La encuesta de percepción distrital madrileña de 2025 es contexto independiente junto al indicador registrado. No influye en el color del mapa.",
            )}</p>
            <a href="https://www.madrid.es/UnidadesDescentralizadas/Calidad/Observatorio_Ciudad/06_S_Percepcion/EncuestasCalidad/EncuestaMadrides/ficheros/2025/Informe_Res_2025.pdf#page=81" target="_blank" rel="noreferrer">
              {tr(locale, "Official 2025 district survey ↗", "Encuesta distrital oficial de 2025 ↗")}
            </a>
          </article>
          <article>
            <h3>{tr(locale, "Visitor: recorded category concentration", "Visitante: concentración de categorías registradas")}</h3>
            <p>{tr(locale,
              "The latest month's theft, robbery and related property categories per km². Violence/property is a separate supporting indicator. Source category definitions differ between Madrid and London.",
              "Hurtos, robos y categorías de propiedad relacionadas del último mes por km². Violencia/propiedad es otro indicador complementario. Las categorías de las fuentes difieren entre Madrid y Londres.",
            )}</p>
            <p>{tr(locale,
              "This is not a visitor incident rate: comparable visitor and commuter counts are not available for each neighbourhood and month.",
              "No es una tasa de delitos por visitante: no hay recuentos comparables de visitantes y población flotante por barrio y mes.",
            )}</p>
            <Link href={localeHref(locale, "/status")}>{tr(locale, "Check source periods ↗", "Consultar períodos de las fuentes ↗")}</Link>
          </article>
        </div>
        <div className="method-source-alert">
          <strong>{tr(locale, "A documented location anomaly", "Una anomalía geográfica documentada")}</strong>
          <p>{tr(locale,
            "Madrid warns that some citizen-information requests are assigned to the 092 administrative address in Guindalera. This can distort total source activity there; the Guindalera map card and profile contain this warning.",
            "El Ayuntamiento de Madrid advierte de que algunas solicitudes de información ciudadana se asignan a la dirección administrativa del 092 en Guindalera. Esto puede distorsionar allí la actividad policial total; el mapa y la ficha de Guindalera muestran la advertencia.",
          )}</p>
          <a href="https://datos.madrid.es/dataset/837676-0-incidencias-recibidas-en-la-emisora-central-de-policia-municipal/information" target="_blank" rel="noreferrer">
            {tr(locale, "Municipal source and location note ↗", "Fuente municipal y advertencia sobre la ubicación ↗")}
          </a>
        </div>
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
