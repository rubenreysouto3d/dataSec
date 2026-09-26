import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaIdFromPath, areaPathId } from "@/lib/area-route";
import { buildVisitorPercentileMap, CITY_FILTER_METHODS } from "@/lib/map-filters";
import {
  areaTypeLabel,
  getAreaProfile,
  getCityMapMetrics,
  getCitySafetySignals,
  getMonthlySummaries,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import {
  localizeCanonicalCategory,
  localeFromValue,
  localeHref,
  localeTag,
  tr,
  type Locale,
} from "@/lib/i18n";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function signalBand(percentile: number | null | undefined, locale: Locale) {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) {
    return tr(locale, "Comparison unavailable", "Comparación no disponible");
  }
  if (percentile < 0.2) return tr(locale, "Low relative signal", "Señal relativa baja");
  if (percentile < 0.4) return tr(locale, "Lower than most areas", "Más baja que en la mayoría de zonas");
  if (percentile < 0.6) return tr(locale, "Around the city middle", "En torno a la media de la ciudad");
  if (percentile < 0.8) return tr(locale, "Higher than most areas", "Más alta que en la mayoría de zonas");
  return tr(locale, "High relative signal", "Señal relativa alta");
}

function signalLevel(percentile: number | null | undefined) {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) {
    return null;
  }
  return Math.min(5, Math.max(1, Math.floor(percentile * 5) + 1));
}

function movementCopy(trend: number | null, locale: Locale) {
  if (trend === null) {
    return tr(locale, "Not enough stored history yet", "Todavía no hay suficiente historial almacenado");
  }
  if (Math.abs(trend) < 5) {
    return tr(locale, "Broadly stable across stored months", "Bastante estable en los meses almacenados");
  }
  return trend > 0
    ? locale === "es"
      ? `Las incidencias registradas suben un ${trend}% en la ventana almacenada`
      : `Recorded incidents are up ${trend}% across the stored window`
    : locale === "es"
      ? `Las incidencias registradas bajan un ${Math.abs(trend)}% en la ventana almacenada`
      : `Recorded incidents are down ${Math.abs(trend)}% across the stored window`;
}

export async function generateStaticParams() {
  if (process.env.GITHUB_PAGES !== "true") return [];
  const areas = await getNeighbourhoods();
  return areas.map((area) => ({ id: areaPathId(area.id) }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  const areaId = areaIdFromPath(id);
  try {
    const [area, monthly] = await Promise.all([
      getAreaProfile(areaId),
      getMonthlySummaries(areaId, 1),
    ]);
    if (!area) return { title: tr(locale, "Area not found", "Zona no encontrada") };

    const latest = monthly[0];
    const mainSafetyCategory = latest?.categories.find((item) => item.group === "safety");
    const place = `${area.name}${area.parentName ? `, ${area.parentName}` : ""}`;
    const latestContext = latest
      ? locale === "es"
        ? `Última captura oficial: ${monthLabel(latest.month, locale)}${mainSafetyCategory ? `; principal categoría de seguridad mapeada: ${localizeCanonicalCategory(locale, mainSafetyCategory.label)}` : ""}.`
        : `Latest official snapshot: ${monthLabel(latest.month, locale)}${mainSafetyCategory ? `; main mapped safety-related category: ${mainSafetyCategory.label}` : ""}.`
      : tr(locale, "Official-source local context.", "Contexto local de fuentes oficiales.");

    return {
      title: `${place}, ${area.cityName}`,
      description:
        locale === "es"
          ? `${place}, ${area.cityName}: contexto de seguridad para residentes y visitantes a partir de datos públicos oficiales. ${latestContext} Incluye tendencia reciente, fuente y metodología.`
          : `${place}, ${area.cityName}: Resident and Visitor safety context from official public data. ${latestContext} Recent trend, source and methodology included.`,
    };
  } catch {
    return { title: tr(locale, "Area profile", "Ficha de zona") };
  }
}

export default async function AreaPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  const areaId = areaIdFromPath(id);

  let area: Awaited<ReturnType<typeof getAreaProfile>> = null;
  let monthly: Awaited<ReturnType<typeof getMonthlySummaries>> = [];
  let cityMapMetrics: Awaited<ReturnType<typeof getCityMapMetrics>> = [];
  let safetySignals: Awaited<ReturnType<typeof getCitySafetySignals>> = [];

  try {
    area = await getAreaProfile(areaId);
    if (area) {
      const [nextMonthly, allAreas] = await Promise.all([
        getMonthlySummaries(area.id, 6),
        getNeighbourhoods(),
      ]);
      monthly = nextMonthly;

      const cityAreaIds = allAreas
        .filter((item) => item.citySlug === area!.citySlug)
        .map((item) => item.id);
      cityMapMetrics = await getCityMapMetrics(area.citySlug, cityAreaIds);
      safetySignals = await getCitySafetySignals(area.citySlug, cityAreaIds, cityMapMetrics);
    }
  } catch (error) {
    console.error(error);
    return (
      <main className="area-page">
        <Link className="back" href={localeHref(locale, "/")}>
          ← {tr(locale, "Home", "Inicio")}
        </Link>
        <section className="error-card">
          <div className="eyebrow">
            {tr(locale, "Dataset unavailable", "Conjunto de datos no disponible")}
          </div>
          <h1>
            {tr(
              locale,
              "We could not load this area right now.",
              "No pudimos cargar esta zona en este momento.",
            )}
          </h1>
          <p>
            {tr(
              locale,
              "dataSec does not substitute fabricated figures when its validated data store cannot be reached.",
              "dataSec no sustituye los datos por cifras inventadas cuando no puede acceder al almacén validado.",
            )}
          </p>
        </section>
      </main>
    );
  }

  if (!area || monthly.length === 0) notFound();

  const latest = monthly[0];
  const latestSafety = latest.categories.filter((item) => item.group === "safety");
  const latestOther = latest.categories.filter((item) => item.group === "other");
  const safetyTotal = latestSafety.reduce((sum, item) => sum + item.count, 0);
  const otherTotal = latestOther.reduce((sum, item) => sum + item.count, 0);
  const top = latestSafety.slice(0, 6);
  const otherTop = latestOther.slice(0, 5);
  const totals = monthly
    .map((item) => ({
      month: item.month,
      total: item.categories
        .filter((category) => category.group === "safety")
        .reduce((sum, category) => sum + category.count, 0),
    }))
    .reverse();
  const first = totals[0]?.total ?? 0;
  const last = totals.at(-1)?.total ?? 0;
  const trend = totals.length < 2 || first === 0 ? null : Math.round(((last - first) / first) * 100);
  const max = Math.max(...totals.map((item) => item.total), 1);
  const topShare = top[0] && safetyTotal > 0 ? Math.round((top[0].count / safetyTotal) * 100) : null;
  const cityMetric = cityMapMetrics.find((item) => item.areaId === area.id);
  const safetySignal = safetySignals.find((item) => item.areaId === area.id);
  const visitorPercentile = buildVisitorPercentileMap(cityMapMetrics).get(area.id) ?? null;
  const residentPercentile =
    safetySignal?.contextualConcernPercentile ??
    cityMetric?.violencePropertyResidentPercentile ??
    cityMetric?.violencePropertyDensityPercentile ??
    null;
  const methods = CITY_FILTER_METHODS[area.citySlug];
  const residentMethod =
    safetySignal?.contextualConcernPercentile !== null &&
    safetySignal?.contextualConcernPercentile !== undefined
      ? tr(
          locale,
          "50% recent personal-harm percentile + 50% 2025 district night-safety perception percentile",
          "50% percentil de daño personal reciente + 50% percentil de percepción de seguridad nocturna del distrito en 2025",
        )
      : cityMetric?.violencePropertyResidentPercentile !== null &&
          cityMetric?.violencePropertyResidentPercentile !== undefined
        ? locale === "es"
          ? area.citySlug === "london"
            ? "violencia + propiedad por 10.000 residentes · denominador del Censo de 2021"
            : "violencia + propiedad por 10.000 residentes empadronados"
          : methods.residentFallbackMethod
        : tr(locale, "violence + property density", "densidad de violencia + propiedad");
  const visitorMethod = tr(
    locale,
    "70% theft + robbery concentration + 30% violence + property concentration",
    "70% concentración de hurtos + robos + 30% concentración de violencia + propiedad",
  );
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://data-sec.vercel.app").replace(/\/$/, "");
  const widgetPathId = encodeURIComponent(areaPathId(area.id));
  const widgetLang = locale === "es" ? "&lang=es" : "";
  const residentWidgetUrl = `${siteUrl}/widget/${widgetPathId}?view=resident${widgetLang}`;
  const visitorWidgetUrl = `${siteUrl}/widget/${widgetPathId}?view=visitor${widgetLang}`;
  const localizedAreaType =
    locale === "es"
      ? area.citySlug === "london"
        ? "zona de la Metropolitan Police"
        : area.areaType === "municipal_district"
          ? "distrito municipal"
          : "barrio municipal"
      : areaTypeLabel(area);

  return (
    <main className="area-page">
      <Link
        className="back"
        href={localeHref(locale, `/city/${area.citySlug}`)}
      >
        ← {area.cityName}
      </Link>
      <section className="area-intro area-intro-minimal">
        <div>
          <div className="eyebrow">
            {area.cityName}{area.parentName ? ` · ${area.parentName}` : ""} · {localizedAreaType}
          </div>
          <h1>{area.name}</h1>
        </div>
        <div className="area-intro-actions">
          <span>{monthLabel(latest.month, locale)}</span>
          <Link
            className="area-compare-link"
            href={localeHref(locale, `/compare?a=${encodeURIComponent(area.id)}`)}
          >
            {tr(locale, "Compare →", "Comparar →")}
          </Link>
        </div>
      </section>

      <section className="area-perspectives area-perspectives-compact">
        <div className="area-perspectives-title">
          <span>{tr(locale, "QUICK VIEW", "VISTA RÁPIDA")}</span>
          <h2>{tr(locale, "Resident or visitor?", "¿Residente o visitante?")}</h2>
        </div>
        <article>
          <span>{tr(locale, "RESIDENT", "RESIDENTE")}</span>
          <strong>{signalBand(residentPercentile, locale)}</strong>
          <small>
            {signalLevel(residentPercentile)
              ? `${tr(locale, "Level", "Nivel")} ${signalLevel(residentPercentile)}/5 · `
              : ""}
            {tr(locale, "Living here", "Vivir aquí")} · {tr(locale, "local to", "local de")} {area.cityName}
          </small>
        </article>
        <article>
          <span>{tr(locale, "VISITOR", "VISITANTE")}</span>
          <strong>{signalBand(visitorPercentile, locale)}</strong>
          <small>
            {signalLevel(visitorPercentile)
              ? `${tr(locale, "Level", "Nivel")} ${signalLevel(visitorPercentile)}/5 · `
              : ""}
            {tr(locale, "Short stay", "Estancia corta")} · {tr(locale, "local to", "local de")} {area.cityName}
          </small>
        </article>
      </section>
      <p className="density-caution area-quick-disclaimer">
        {tr(
          locale,
          "Context only — these local indicators describe official-source patterns and do not predict or guarantee personal safety.",
          "Solo contexto: estos indicadores locales describen patrones de fuentes oficiales y no predicen ni garantizan la seguridad personal.",
        )}
      </p>

      <section className="area-key-facts area-key-facts-three">
        <article>
          <span>{tr(locale, "SAFETY-RELATED", "RELACIONADO CON SEGURIDAD")}</span>
          <strong>{safetyTotal.toLocaleString(localeTag(locale))}</strong>
          <small>
            {monthLabel(latest.month, locale)} · {tr(locale, "mapped categories", "categorías mapeadas")}
          </small>
        </article>
        <article>
          <span>{tr(locale, "TREND", "TENDENCIA")}</span>
          <strong>{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}</strong>
          <small>
            {trend === null
              ? tr(locale, "More history needed", "Hace falta más historial")
              : Math.abs(trend) < 5
                ? tr(locale, "Stable", "Estable")
                : trend > 0
                  ? tr(locale, "Up", "Sube")
                  : tr(locale, "Down", "Baja")}
          </small>
        </article>
        <article>
          <span>{tr(locale, "MAIN CATEGORY", "CATEGORÍA PRINCIPAL")}</span>
          <strong>{top[0] ? localizeCanonicalCategory(locale, top[0].label) : "—"}</strong>
          <small>
            {topShare !== null
              ? locale === "es"
                ? `${topShare}% de la última captura`
                : `${topShare}% of latest snapshot`
              : tr(locale, "No category mix", "Sin mezcla de categorías")}
          </small>
        </article>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span>{tr(locale, "NOW", "AHORA")}</span>
              <h2>{tr(locale, "What stands out", "Qué destaca")}</h2>
            </div>
          </div>
          {top.length ? (
            <div className="category-list">
              {top.map((item) => (
                <div className="category-row" key={item.category}>
                  <div>
                    <strong>{localizeCanonicalCategory(locale, item.label)}</strong>
                    <small>
                      {item.count.toLocaleString(localeTag(locale))}
                      {safetyTotal > 0 ? ` · ${Math.round((item.count / safetyTotal) * 100)}%` : ""}
                    </small>
                  </div>
                  <div className="bar"><i style={{ width: `${Math.max(4, (item.count / (top[0]?.count || 1)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="notice">
              {tr(
                locale,
                "No mapped safety category is available for this snapshot.",
                "No hay ninguna categoría de seguridad mapeada disponible para esta captura.",
              )}
            </div>
          )}
        </section>

        <section className="panel wide">
          <div className="panel-head">
            <div>
              <span>{tr(locale, "TREND", "TENDENCIA")}</span>
              <h2>{tr(locale, "Recent safety-related months", "Meses recientes relacionados con seguridad")}</h2>
            </div>
          </div>
          <div className="trend-chart">
            {totals.map((item) => (
              <div className="trend-column" key={item.month}>
                <strong>{item.total}</strong>
                <div className="trend-track"><i style={{ height: `${Math.max(5, (item.total / max) * 100)}%` }} /></div>
                <span>{monthLabel(item.month, locale).split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {otherTop.length ? (
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <span>{tr(locale, "CONTEXT", "CONTEXTO")}</span>
              <h2>{tr(locale, "Other recorded activity", "Otra actividad registrada")}</h2>
            </div>
          </div>
          <p className="density-caution">
            {tr(
              locale,
              "These records are kept separate from the safety categories above. They can include emergency assistance, traffic, mediation and other non-crime police responses.",
              "Estos registros se mantienen separados de las categorías de seguridad anteriores. Pueden incluir asistencia de emergencia, tráfico, mediación y otras respuestas policiales no delictivas.",
            )}
          </p>
          <div className="category-list">
            {otherTop.map((item) => (
              <div className="category-row" key={item.category}>
                <div>
                  <strong>{localizeCanonicalCategory(locale, item.label)}</strong>
                  <small>{item.count.toLocaleString(localeTag(locale))}</small>
                </div>
                <div className="bar"><i style={{ width: `${Math.max(4, (item.count / (otherTop[0]?.count || 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <small>
            {otherTotal.toLocaleString(localeTag(locale))}{" "}
            {tr(
              locale,
              "non-safety source records in the latest snapshot.",
              "registros no relacionados con seguridad en la última captura.",
            )}
          </small>
        </section>
      ) : null}

      <details className="area-data-details area-embed-details">
        <summary>
          <span>{tr(locale, "Embed this area", "Insertar esta zona")}</span>
          <small>
            {tr(
              locale,
              "Prototype widget for property, travel or relocation pages",
              "Widget prototipo para páginas inmobiliarias, de viajes o relocation",
            )}
          </small>
        </summary>
        <div>
          <p>
            {tr(
              locale,
              "The widget reuses the same local Resident or Visitor signal shown on dataSec. It is not a separate score.",
              "El widget reutiliza la misma señal local de Residente o Visitante que muestra dataSec. No es una puntuación independiente.",
            )}
          </p>
          <div className="embed-code-block">
            <strong>{tr(locale, "Resident", "Residente")}</strong>
            <code>{`<iframe src="${residentWidgetUrl}" width="360" height="210" loading="lazy"></iframe>`}</code>
            <a href={residentWidgetUrl} target="_blank" rel="noreferrer">{tr(locale, "Preview resident widget ↗", "Ver widget de residente ↗")}</a>
          </div>
          <div className="embed-code-block">
            <strong>{tr(locale, "Visitor", "Visitante")}</strong>
            <code>{`<iframe src="${visitorWidgetUrl}" width="360" height="210" loading="lazy"></iframe>`}</code>
            <a href={visitorWidgetUrl} target="_blank" rel="noreferrer">{tr(locale, "Preview visitor widget ↗", "Ver widget de visitante ↗")}</a>
          </div>
          <small>
            {tr(
              locale,
              "Prototype embed only. Commercial licensing and usage limits are not defined yet.",
              "Solo prototipo de inserción. Las licencias comerciales y los límites de uso todavía no están definidos.",
            )}
          </small>
        </div>
      </details>

      <details className="area-data-details">
        <summary>
          <span>
            {tr(locale, "About the data for", "Sobre los datos de")} {area.name}
          </span>
          <small>{tr(locale, "Source, interpretation and limitations", "Fuente, interpretación y limitaciones")}</small>
        </summary>
        <div>
          {area.citySlug === "london" ? (
            <>
              <p>
                {tr(
                  locale,
                  "These are police-recorded street-level incidents supplied through UK Police open data. Published source locations are approximate, and recorded crime is not identical to underlying victimisation or personal risk.",
                  "Son incidencias registradas por la policía a nivel de calle y publicadas mediante UK Police open data. Las ubicaciones publicadas son aproximadas y la criminalidad registrada no equivale exactamente a la victimización real ni al riesgo personal.",
                )}
              </p>
              <p>
                {tr(
                  locale,
                  "Density compares recorded incidents per km² between London policing neighbourhoods for the same month. Central areas, nightlife and transport hubs can appear high because of footfall.",
                  "La densidad compara incidencias registradas por km² entre zonas policiales de Londres para el mismo mes. Las zonas centrales, de ocio nocturno y los nodos de transporte pueden aparecer altas por la afluencia.",
                )}
              </p>
            </>
          ) : (
            <>
              <p>
                {tr(
                  locale,
                  "These are incidents handled by Madrid Municipal Police central dispatch. The dataset is broader than crime: it also includes traffic, public-space, assistance, administrative and other police responses.",
                  "Son incidencias gestionadas por la central de Policía Municipal de Madrid. El conjunto es más amplio que la criminalidad: también incluye tráfico, espacio público, asistencia, actuaciones administrativas y otras respuestas policiales.",
                )}
              </p>
              <p>
                {tr(
                  locale,
                  "Density compares source incidents per km² between Madrid municipal neighbourhoods for the same snapshot. It must not be interpreted as a crime rate or personal-risk score.",
                  "La densidad compara incidencias de la fuente por km² entre barrios municipales de Madrid para la misma captura. No debe interpretarse como tasa de criminalidad ni como puntuación de riesgo personal.",
                )}
              </p>
            </>
          )}
          <p>
            <strong>{tr(locale, "Resident:", "Residente:")}</strong> {residentMethod}.{" "}
            {tr(
              locale,
              `The percentile compares this area only with other areas in ${area.cityName}.`,
              `El percentil compara esta zona solo con otras zonas de ${area.cityName}.`,
            )}
          </p>
          <p>
            <strong>{tr(locale, "Visitor:", "Visitante:")}</strong> {visitorMethod}.{" "}
            {tr(
              locale,
              `The percentile compares this area only with other areas in ${area.cityName}.`,
              `El percentil compara esta zona solo con otras zonas de ${area.cityName}.`,
            )}
          </p>
          <p>
            <strong>{tr(locale, "Cross-city comparison:", "Comparación entre ciudades:")}</strong>{" "}
            {tr(
              locale,
              "Resident and Visitor percentiles are local context indicators, not a common score for comparing Madrid with London.",
              "Los percentiles de Residente y Visitante son indicadores de contexto local, no una puntuación común para comparar Madrid con Londres.",
            )}
          </p>
          <a href={area.sourceUrl} target="_blank" rel="noreferrer">
            {tr(locale, "Open the official source ↗", "Abrir la fuente oficial ↗")}
          </a>
        </div>
      </details>
    </main>
  );
}
