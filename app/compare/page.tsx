import { Suspense } from "react";
import Link from "next/link";
import {
  getCityMapMetrics,
  getCitySafetySignals,
  getNeighbourhoods,
  type CityMapMetric,
  type CitySafetySignal,
} from "@/lib/data";
import CompareClient from "./CompareClient";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";

export const metadata = {
  title: "Compare areas",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let metrics: CityMapMetric[] = [];
  let safetySignals: CitySafetySignal[] = [];
  let error = false;

  try {
    areas = await getNeighbourhoods();
    const londonIds = areas.filter((area) => area.citySlug === "london").map((area) => area.id);
    const madridIds = areas.filter((area) => area.citySlug === "madrid").map((area) => area.id);
    const [londonMetrics, madridMetrics] = await Promise.all([
      getCityMapMetrics("london", londonIds),
      getCityMapMetrics("madrid", madridIds),
    ]);
    metrics = [...londonMetrics, ...madridMetrics];
    safetySignals = await getCitySafetySignals("madrid", madridIds, madridMetrics);
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  return (
    <main className="compare-page">
      <Link className="back" href={localeHref(locale, "/")}>
        ← {tr(locale, "Home", "Inicio")}
      </Link>
      <div className="eyebrow">{tr(locale, "Local comparison", "Comparación local")}</div>
      <h1>{tr(locale, "Compare two areas.", "Compara dos zonas.")}</h1>
      <Suspense
        fallback={
          <div className="notice">
            {tr(locale, "Loading comparison…", "Cargando comparación…")}
          </div>
        }
      >
        <CompareClient
          areas={areas}
          metrics={metrics}
          safetySignals={safetySignals}
          sourceError={error}
        />
      </Suspense>
    </main>
  );
}
