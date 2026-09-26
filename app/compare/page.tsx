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

export const metadata = {
  title: "Compare areas",
};

export const dynamic = "force-static";

export default async function ComparePage() {
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
      <Link className="back" href="/">← Home</Link>
      <div className="eyebrow">Local comparison</div>
      <h1>Compare two areas.</h1>
      <Suspense fallback={<div className="notice">Loading comparison…</div>}>
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
