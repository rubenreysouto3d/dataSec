import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaHref } from "@/lib/area-route";
import {
  type CitySlug,
  areaDisplayName,
  cityNames,
  getCityHarmTrends,
  getCityMapMetrics,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import {
  localeFromValue,
  localeHref,
  localeTag,
  tr,
  type Locale,
} from "@/lib/i18n";

export const revalidate = 43200;

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ lang?: string }>;
};

function isCitySlug(value: string): value is CitySlug {
  return value === "london" || value === "madrid";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ city }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  if (!isCitySlug(city)) return { title: tr(locale, "City trends", "Tendencias de ciudad") };
  return {
    title:
      locale === "es"
        ? `Tendencias de daño registrado en ${cityNames[city]}`
        : `${cityNames[city]} recorded harm trends`,
    description:
      locale === "es"
        ? `Consulta qué zonas de ${cityNames[city]} registraron los mayores cambios recientes en la señal específica de daño de la ciudad, comparando dos ventanas de tres meses.`
        : `See which ${cityNames[city]} areas recorded the largest recent changes in the city-specific harm signal, using two three-month windows.`,
  };
}

function signed(value: number, locale: Locale) {
  const formatted = value.toLocaleString(localeTag(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value > 0 ? "+" : ""}${formatted}`;
}

function localizedSignalLabel(label: string, locale: Locale) {
  if (locale === "en") return label;
  if (label === "Personal-harm police dispatches") {
    return "Incidencias policiales relacionadas con daño personal";
  }
  if (label === "Violence + property police-recorded crime") {
    return "Delitos registrados de violencia + propiedad";
  }
  return label;
}

function TrendList({
  title,
  note,
  rows,
  areaName,
  locale,
}: {
  title: string;
  note: string;
  rows: Array<{
    areaId: string;
    previousRatePer10k: number | null;
    recentRatePer10k: number | null;
    deltaRatePer10k: number | null;
    percentChange: number | null;
  }>;
  areaName: Map<string, string>;
  locale: Locale;
}) {
  return (
    <section className="city-trend-block">
      <div className="city-trend-heading">
        <h2>{title}</h2>
        <p>{note}</p>
      </div>
      <div className="city-trend-table">
        {rows.length ? rows.map((row, index) => (
          <Link
            href={localeHref(locale, areaHref(row.areaId))}
            className="city-trend-row"
            key={row.areaId}
          >
            <span className="city-trend-rank">{String(index + 1).padStart(2, "0")}</span>
            <strong>{areaName.get(row.areaId) ?? row.areaId}</strong>
            <span>
              {row.previousRatePer10k?.toLocaleString(localeTag(locale), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? "—"}
              <small> → </small>
              {row.recentRatePer10k?.toLocaleString(localeTag(locale), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) ?? "—"}
              <small> {tr(locale, "/10k", "/10.000")}</small>
            </span>
            <b>{row.deltaRatePer10k === null ? "—" : signed(row.deltaRatePer10k, locale)}</b>
          </Link>
        )) : (
          <div className="notice">
            {tr(
              locale,
              "No material change is available for this window.",
              "No hay un cambio material disponible para esta ventana.",
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function CityTrendsPage({ params, searchParams }: Props) {
  const [{ city }, query] = await Promise.all([params, searchParams]);
  const locale = localeFromValue(query.lang);
  if (!isCitySlug(city)) notFound();

  const areas = await getNeighbourhoods(city);
  const areaIds = areas.map((area) => area.id);
  const metrics = await getCityMapMetrics(city, areaIds);
  const trends = await getCityHarmTrends(city, areaIds, metrics);
  if (!trends) notFound();

  const areaName = new Map(areas.map((area) => [area.id, areaDisplayName(area)]));
  const usable = trends.areas.filter(
    (row) => row.deltaRatePer10k !== null && Number.isFinite(row.deltaRatePer10k),
  );
  const decreases = usable
    .filter((row) => (row.deltaRatePer10k ?? 0) < -0.05)
    .sort((a, b) => (a.deltaRatePer10k ?? 0) - (b.deltaRatePer10k ?? 0))
    .slice(0, 12);
  const increases = usable
    .filter((row) => (row.deltaRatePer10k ?? 0) > 0.05)
    .sort((a, b) => (b.deltaRatePer10k ?? 0) - (a.deltaRatePer10k ?? 0))
    .slice(0, 12);

  return (
    <main className="method-page method-page-clean city-trends-page">
      <Link className="back" href={localeHref(locale, `/city/${city}`)}>
        ← {cityNames[city]} {tr(locale, "map", "mapa")}
      </Link>
      <div className="eyebrow">
        {tr(locale, "Recorded trend", "Tendencia registrada")} · {cityNames[city]}
      </div>
      <h1>{tr(locale, "What changed recently?", "¿Qué ha cambiado recientemente?")}</h1>
      <p className="method-lead">
        {tr(locale, "This compares the average monthly", "Esto compara la tasa media mensual de")}{" "}
        <strong>{localizedSignalLabel(trends.signalLabel, locale).toLowerCase()}</strong>{" "}
        {tr(locale, "in", "en")} {monthLabel(trends.previousMonths[0], locale)}–
        {monthLabel(trends.previousMonths.at(-1)!, locale)}{" "}
        {tr(locale, "with", "con")} {monthLabel(trends.recentMonths[0], locale)}–
        {monthLabel(trends.recentMonths.at(-1)!, locale)}.
      </p>

      <section className="method-limits city-trend-definition">
        <div>
          <span>{tr(locale, "SIGNAL", "SEÑAL")}</span>
          <h2>{localizedSignalLabel(trends.signalLabel, locale)}</h2>
        </div>
        <div>
          <p>
            {tr(
              locale,
              "Rates are shown per 10,000 residents and changes are ranked by the absolute rate difference, not by a universal safety score.",
              "Las tasas se muestran por 10.000 residentes y los cambios se ordenan por la diferencia absoluta de tasa, no por una puntuación universal de seguridad.",
            )}
          </p>
          <p>
            {tr(
              locale,
              "Short windows can move because of reporting, isolated events, seasonality and normal month-to-month variation.",
              "Las ventanas cortas pueden variar por denuncia, sucesos aislados, estacionalidad y variación normal de un mes a otro.",
            )}
          </p>
          {city === "london" ? (
            <p>
              {tr(
                locale,
                "London resident rates use the 2021 Census denominator currently available across all wards.",
                "Las tasas de residentes de Londres usan el denominador del Censo de 2021 disponible actualmente para todos los wards.",
              )}
            </p>
          ) : null}
        </div>
      </section>

      <div className="city-trend-columns">
        <TrendList
          title={tr(locale, "Largest recorded decreases", "Mayores bajadas registradas")}
          note={tr(
            locale,
            "Lower recent rate than the preceding three-month window.",
            "Tasa reciente menor que en la ventana de tres meses anterior.",
          )}
          rows={decreases}
          areaName={areaName}
          locale={locale}
        />
        <TrendList
          title={tr(locale, "Largest recorded increases", "Mayores subidas registradas")}
          note={tr(
            locale,
            "Higher recent rate than the preceding three-month window.",
            "Tasa reciente mayor que en la ventana de tres meses anterior.",
          )}
          rows={increases}
          areaName={areaName}
          locale={locale}
        />
      </div>

      <p className="density-caution city-trend-disclaimer">
        {tr(
          locale,
          "A decrease does not mean an area became “safe”, and an increase does not mean it became “dangerous”. This is a descriptive change in one city-specific official-source signal, not a prediction of personal risk.",
          "Una bajada no significa que una zona se haya vuelto «segura», ni una subida que se haya vuelto «peligrosa». Es un cambio descriptivo en una señal oficial específica de la ciudad, no una predicción de riesgo personal.",
        )}
      </p>
    </main>
  );
}
