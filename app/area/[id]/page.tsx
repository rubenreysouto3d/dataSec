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

type Props = { params: Promise<{ id: string }> };

function signalBand(percentile: number | null | undefined) {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) {
    return "Comparison unavailable";
  }
  if (percentile < 0.2) return "Low relative signal";
  if (percentile < 0.4) return "Lower than most areas";
  if (percentile < 0.6) return "Around the city middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "High relative signal";
}

function movementCopy(trend: number | null) {
  if (trend === null) return "Not enough stored history yet";
  if (Math.abs(trend) < 5) return "Broadly stable across stored months";
  return trend > 0
    ? `Recorded incidents are up ${trend}% across the stored window`
    : `Recorded incidents are down ${Math.abs(trend)}% across the stored window`;
}

export async function generateStaticParams() {
  if (process.env.GITHUB_PAGES !== "true") return [];
  const areas = await getNeighbourhoods();
  return areas.map((area) => ({ id: areaPathId(area.id) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const areaId = areaIdFromPath(id);
  try {
    const area = await getAreaProfile(areaId);
    if (!area) return { title: "Area not found" };

    return {
      title: `${area.name}, ${area.cityName}`,
      description:
        area.citySlug === "london"
          ? `Official Metropolitan Police neighbourhood incident data, category mix, local density context and stored history for ${area.name}, London.`
          : `Official Madrid Municipal Police dispatch incident data, category mix, local density context and stored history for ${area.name}, Madrid.`,
    };
  } catch {
    return { title: "Area profile" };
  }
}

export default async function AreaPage({ params }: Props) {
  const { id } = await params;
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
        <Link className="back" href="/">← Home</Link>
        <section className="error-card">
          <div className="eyebrow">Dataset unavailable</div>
          <h1>We could not load this area right now.</h1>
          <p>dataSec does not substitute fabricated figures when its validated data store cannot be reached.</p>
        </section>
      </main>
    );
  }

  if (!area || monthly.length === 0) notFound();

  const latest = monthly[0];
  const top = latest.categories.slice(0, 6);
  const totals = monthly
    .map((item) => ({ month: item.month, total: item.total }))
    .reverse();
  const first = totals[0]?.total ?? 0;
  const last = totals.at(-1)?.total ?? 0;
  const trend = totals.length < 2 || first === 0 ? null : Math.round(((last - first) / first) * 100);
  const max = Math.max(...totals.map((item) => item.total), 1);
  const topShare = top[0] && latest.total > 0 ? Math.round((top[0].count / latest.total) * 100) : null;
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
      ? "6-month personal harm + resident night-safety perception"
      : cityMetric?.violencePropertyResidentPercentile !== null &&
          cityMetric?.violencePropertyResidentPercentile !== undefined
        ? methods.residentFallbackMethod
        : "violence + property density";
  const visitorMethod = "70% theft + robbery concentration · 30% violence + property concentration";

  return (
    <main className="area-page">
      <Link className="back" href={`/city/${area.citySlug}`}>← {area.cityName}</Link>
      <section className="area-intro area-intro-minimal">
        <div>
          <div className="eyebrow">{area.cityName} · {areaTypeLabel(area)}</div>
          <h1>{area.name}</h1>
        </div>
        <div className="area-intro-actions">
          <span>{monthLabel(latest.month)}</span>
          <Link className="area-compare-link" href={`/compare?a=${encodeURIComponent(area.id)}`}>
            Compare →
          </Link>
        </div>
      </section>

      <section className="area-perspectives area-perspectives-compact">
        <div className="area-perspectives-title">
          <span>QUICK VIEW</span>
          <h2>Resident or visitor?</h2>
        </div>
        <article>
          <span>RESIDENT</span>
          <strong>{signalBand(residentPercentile)}</strong>
          <small>Living here</small>
        </article>
        <article>
          <span>VISITOR</span>
          <strong>{signalBand(visitorPercentile)}</strong>
          <small>Short stay</small>
        </article>
      </section>

      <section className="area-key-facts area-key-facts-three">
        <article>
          <span>RECORDED</span>
          <strong>{latest.total.toLocaleString("en-GB")}</strong>
          <small>{monthLabel(latest.month)}</small>
        </article>
        <article>
          <span>TREND</span>
          <strong>{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}</strong>
          <small>{trend === null ? "More history needed" : Math.abs(trend) < 5 ? "Stable" : trend > 0 ? "Up" : "Down"}</small>
        </article>
        <article>
          <span>MAIN CATEGORY</span>
          <strong>{top[0]?.label ?? "—"}</strong>
          <small>{topShare !== null ? `${topShare}% of latest snapshot` : "No category mix"}</small>
        </article>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head"><div><span>NOW</span><h2>What stands out</h2></div></div>
          <div className="category-list">
            {top.map((item) => (
              <div className="category-row" key={item.category}>
                <div>
                  <strong>{item.label}</strong>
                  <small>
                    {item.count.toLocaleString("en-GB")}
                    {latest.total > 0 ? ` · ${Math.round((item.count / latest.total) * 100)}%` : ""}
                  </small>
                </div>
                <div className="bar"><i style={{ width: `${Math.max(4, (item.count / (top[0]?.count || 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel wide">
          <div className="panel-head">
            <div><span>TREND</span><h2>Recent months</h2></div>
          </div>
          <div className="trend-chart">
            {totals.map((item) => (
              <div className="trend-column" key={item.month}>
                <strong>{item.total}</strong>
                <div className="trend-track"><i style={{ height: `${Math.max(5, (item.total / max) * 100)}%` }} /></div>
                <span>{monthLabel(item.month).split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <details className="area-data-details">
        <summary>
          <span>About the data for {area.name}</span>
          <small>Source, interpretation and limitations</small>
        </summary>
        <div>
          {area.citySlug === "london" ? (
            <>
              <p>
                These are police-recorded street-level incidents supplied through UK Police open data. Published source locations are approximate, and recorded crime is not identical to underlying victimisation or personal risk.
              </p>
              <p>
                Density compares recorded incidents per km² between London policing neighbourhoods for the same month. Central areas, nightlife and transport hubs can appear high because of footfall.
              </p>
            </>
          ) : (
            <>
              <p>
                These are incidents handled by Madrid Municipal Police central dispatch. The dataset is broader than crime: it also includes traffic, public-space, assistance, administrative and other police responses.
              </p>
              <p>
                Density compares source incidents per km² between Madrid municipal neighbourhoods for the same snapshot. It must not be interpreted as a crime rate or personal-risk score.
              </p>
            </>
          )}
          <p><strong>Resident:</strong> {residentMethod}.</p>
          <p><strong>Visitor:</strong> {visitorMethod}.</p>
          <a href={area.sourceUrl} target="_blank" rel="noreferrer">Open the official source ↗</a>
        </div>
      </details>
    </main>
  );
}
