import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaHref } from "@/lib/area-route";
import {
  areaDisplayName,
  type CitySlug,
  cityNames,
  getCityMapMetrics,
  getCitySafetySignals,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import {
  buildVisitorPercentileMap,
  cityFilterMethods,
} from "@/lib/map-filters";
import {
  bandNumber,
  metricForLayer,
  relativeBand,
} from "@/lib/map-view";
import { localeFromValue, localeHref, localeTag, tr } from "@/lib/i18n";

type Audience = "resident" | "visitor";
type Props = {
  params: Promise<{ city: string; audience: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function isCitySlug(value: string): value is CitySlug {
  return value === "london" || value === "madrid";
}

function isAudience(value: string): value is Audience {
  return value === "resident" || value === "visitor";
}

const audienceCopy: Record<Audience, {
  title: string;
  description: string;
  intro: string;
}> = {
  resident: {
    title: "Neighbourhood context for residents",
    description: "Compare neighbourhoods using the same Resident signal as the interactive map.",
    intro: "For people thinking about living in the city. The signal is local to this city and uses the best documented resident context currently available here.",
  },
  visitor: {
    title: "Neighbourhood context for visitors",
    description: "Compare neighbourhoods using the same Visitor signal as the interactive map.",
    intro: "For short stays and accommodation decisions. The signal weights theft and robbery more heavily and is designed to avoid treating resident population as the only exposure denominator.",
  },
};

export function generateStaticParams() {
  return [
    { city: "madrid", audience: "resident" },
    { city: "madrid", audience: "visitor" },
    { city: "london", audience: "resident" },
    { city: "london", audience: "visitor" },
  ];
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ city, audience }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  if (!isCitySlug(city) || !isAudience(audience)) {
    return { title: tr(locale, "City context", "Contexto de ciudad") };
  }

  const cityName = cityNames[city];
  const audienceName =
    audience === "resident"
      ? tr(locale, "residents", "residentes")
      : tr(locale, "visitors", "visitantes");
  return {
    title:
      locale === "es"
        ? `Contexto de seguridad por barrios de ${cityName} para ${audienceName}`
        : `${cityName} neighbourhood safety context for ${audienceName}`,
    description:
      locale === "es"
        ? `Datos locales oficiales para comparar barrios de ${cityName} para ${audienceName}. Usa la misma señal local de ${audience === "resident" ? "Residente" : "Visitante"} que el mapa de dataSec, con metodología y limitaciones visibles.`
        : `Official local data for comparing ${cityName} neighbourhoods for ${audienceName}. Uses the same city-local ${audience} signal as the dataSec map, with methodology and limitations shown.`,
  };
}

export default async function CityAudiencePage({ params, searchParams }: Props) {
  const [{ city, audience }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  if (!isCitySlug(city) || !isAudience(audience)) notFound();

  const areas = await getNeighbourhoods(city);
  const areaIds = areas.map((area) => area.id);
  const metrics = await getCityMapMetrics(city, areaIds);
  const safetySignals = await getCitySafetySignals(city, areaIds, metrics);

  const metricById = new Map(metrics.map((metric) => [metric.areaId, metric]));
  const safetyById = new Map(safetySignals.map((signal) => [signal.areaId, signal]));
  const visitorById = buildVisitorPercentileMap(metrics);

  const rows = areas
    .map((area) => {
      const selected =
        audience === "resident"
          ? metricForLayer(
              metricById.get(area.id),
              "contextual-overview",
              safetyById.get(area.id),
              visitorById.get(area.id),
            )
          : metricForLayer(
              metricById.get(area.id),
              "visitor-context",
              safetyById.get(area.id),
              visitorById.get(area.id),
            );
      return {
        area,
        percentile: selected.percentile,
        level: bandNumber(selected.percentile),
      };
    })
    .filter(
      (row): row is typeof row & { percentile: number; level: number } =>
        row.percentile !== null && row.level !== null && Number.isFinite(row.percentile),
    )
    .sort((a, b) => a.percentile - b.percentile);

  const latestMonth = metrics.reduce(
    (latest, metric) => (!latest || metric.month > latest ? metric.month : latest),
    "",
  );

  const method =
    audience === "visitor"
      ? tr(
          locale,
          "70% theft + robbery concentration + 30% violence + property concentration",
          "70% concentración de hurtos + robos + 30% concentración de violencia + propiedad",
        )
      : city === "madrid" && safetySignals.some((signal) => signal.contextualConcernPercentile !== null)
        ? tr(
            locale,
            "50% recent personal-harm percentile + 50% 2025 district night-safety perception percentile",
            "50% percentil de daño personal reciente + 50% percentil de percepción de seguridad nocturna del distrito en 2025",
          )
        : cityFilterMethods(city, locale).residentFallbackMethod;

  const copy = audienceCopy[audience];
  const mode = audience === "resident" ? "resident" : "visitor";
  const title =
    locale === "es"
      ? audience === "resident"
        ? "Contexto de barrios para residentes"
        : "Contexto de barrios para visitantes"
      : copy.title;
  const intro =
    locale === "es"
      ? audience === "resident"
        ? "Para personas que están valorando vivir en la ciudad. La señal es local a esta ciudad y utiliza el mejor contexto residencial oficial documentado que tenemos disponible."
        : "Para estancias cortas y decisiones de alojamiento. La señal da más peso a hurtos y robos y evita tratar la población empadronada como único denominador de exposición."
      : copy.intro;

  return (
    <main className="method-page method-page-clean city-intent-page">
      <Link
        className="back"
        href={localeHref(locale, `/city/${city}?view=${audience}`)}
      >
        ← {cityNames[city]} {tr(locale, "map", "mapa")}
      </Link>

      <div className="eyebrow">
        {cityNames[city]} ·{" "}
        {audience === "resident"
          ? tr(locale, "Resident", "Residente")
          : tr(locale, "Visitor", "Visitante")}{" "}
        {tr(locale, "view", "vista")}
      </div>
      <h1>{title}</h1>
      <p className="method-lead">{intro}</p>

      <section className="method-limits city-intent-definition">
        <div>
          <span>{tr(locale, "ACTIVE METHOD", "MÉTODO ACTIVO")}</span>
          <h2>
            {audience === "resident"
              ? tr(locale, "Resident context", "Contexto para residentes")
              : tr(locale, "Visitor context", "Contexto para visitantes")}
          </h2>
        </div>
        <div>
          <p>{method}.</p>
          <p>
            {latestMonth
              ? `${tr(locale, "Latest source snapshot:", "Última captura de la fuente:")} ${monthLabel(latestMonth, locale)}. `
              : ""}
            {tr(
              locale,
              `Levels and percentiles compare areas only inside ${cityNames[city]}.`,
              `Los niveles y percentiles comparan zonas solo dentro de ${cityNames[city]}.`,
            )}
          </p>
        </div>
      </section>

      <div className="city-intent-actions">
        <Link
          className="city-intent-primary"
          href={localeHref(locale, `/city/${city}?view=${audience}`)}
        >
          {locale === "es"
            ? `Abrir mapa interactivo de ${audience === "resident" ? "Residente" : "Visitante"} →`
            : `Open the interactive ${audience} map →`}
        </Link>
        <Link
          href={localeHref(
            locale,
            `/city/${city}/${audience === "resident" ? "visitor" : "resident"}`,
          )}
        >
          {locale === "es"
            ? `Cambiar a contexto de ${audience === "resident" ? "Visitante" : "Residente"}`
            : `Switch to ${audience === "resident" ? "Visitor" : "Resident"} context`}
        </Link>
      </div>

      <section
        className="city-intent-bands"
        aria-label={tr(locale, "Local five-level area groups", "Grupos locales de cinco niveles")}
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const bandRows = rows.filter((row) => row.level === level).slice(0, 16);
          if (!bandRows.length) return null;
          const label = relativeBand(
            bandRows[Math.floor(bandRows.length / 2)]?.percentile ?? null,
            mode,
            locale,
          );

          return (
            <article className="city-intent-band" key={level}>
              <div className="city-intent-band-head">
                <span>{tr(locale, "LEVEL", "NIVEL")} {level}/5</span>
                <h2>{label}</h2>
                <small>
                  {rows
                    .filter((row) => row.level === level)
                    .length.toLocaleString(localeTag(locale))}{" "}
                  {tr(locale, "areas in this local band", "zonas en esta franja local")}
                </small>
              </div>

              <div className="city-intent-area-list">
                {bandRows.map(({ area, percentile }) => (
                  <Link href={localeHref(locale, areaHref(area.id))} key={area.id}>
                    <strong>{areaDisplayName(area)}</strong>
                    <span>
                      {locale === "es"
                        ? `percentil ${Math.round(percentile * 100)}`
                        : `${Math.round(percentile * 100)}th percentile`}
                    </span>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <p className="density-caution city-intent-disclaimer">
        {tr(
          locale,
          "These groups describe a relative official-source signal, not whether an area is “safe” or “dangerous”. A lower level does not guarantee personal safety, and a higher level can reflect reporting, footfall, nightlife, transport activity and source methodology.",
          "Estos grupos describen una señal relativa de fuentes oficiales, no si una zona es «segura» o «peligrosa». Un nivel menor no garantiza seguridad personal y uno mayor puede reflejar denuncia, afluencia, vida nocturna, transporte y metodología de la fuente.",
        )}
      </p>

      <div className="city-intent-footer-links">
        <Link href={localeHref(locale, "/methodology")}>
          {tr(locale, "Methodology →", "Metodología →")}
        </Link>
        <Link href={localeHref(locale, "/disclaimer")}>
          {tr(locale, "Use and limitations →", "Uso y limitaciones →")}
        </Link>
        <Link href={localeHref(locale, "/status")}>
          {tr(locale, "Data status →", "Estado de los datos →")}
        </Link>
      </div>
    </main>
  );
}
