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

function signalLevel(percentile: number | null | undefined) {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) {
    return null;
  }
  return Math.min(5, Math.max(1, Math.floor(percentile * 5) + 1));
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
    const [area, monthly] = await Promise.all([
      getAreaProfile(areaId),
      getMonthlySummaries(areaId, 1),
    ]);
    if (!area) return { title: "Area not found" };

    const latest = monthly[0];
    const mainSafetyCategory = latest?.categories.find((item) => item.group === "safety");
    const place = `${area.name}${area.parentName ? `, ${area.parentName}` : ""}`;
    const latestContext = latest
      ? `Latest official snapshot: ${monthLabel(latest.month)}${mainSafetyCategory ? `; main mapped safety-related category: ${mainSafetyCategory.label}` : ""}.`
      : "Official-source local context.";

    return {
      title: `${place}, ${area.cityName}`,
      description:
        `${place}, ${area.cityName}: Resident and Visitor safety context from official public data. ${latestContext} Recent trend, source and methodology included.`,
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
      ? "50% recent personal-harm percentile + 50% 2025 district night-safety perception percentile"
      : cityMetric?.violencePropertyResidentPercentile !== null &&
          cityMetric?.violencePropertyResidentPercentile !== undefined
        ? methods.residentFallbackMethod
        : "violence + property density";
  const visitorMethod = "70% theft + robbery concentration + 30% violence + property concentration";

  return (
    <main className="area-page">
      <Link className="back" href={`/city/${area.citySlug}`}>← {area.cityName}</Link>
      <section className="area-intro area-intro-minimal">
        <div>
          <div className="eyebrow">
            {area.cityName}{area.parentName ? ` · ${area.parentName}` : ""} · {areaTypeLabel(area)}
          </div>
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
          <small>
            {signalLevel(residentPercentile) ? `Level ${signalLevel(residentPercentile)}/5 · ` : ""}
            Living here · local to {area.cityName}
          </small>
        </article>
        <article>
          <span>VISITOR</span>
          <strong>{signalBand(visitorPercentile)}</strong>
          <small>
            {signalLevel(visitorPercentile) ? `Level ${signalLevel(visitorPercentile)}/5 · ` : ""}
            Short stay · local to {area.cityName}
          </small>
        </article>
      </section>
      <p className="density-caution area-quick-disclaimer">
        Context only — these local indicators describe official-source patterns and do not predict or guarantee personal safety.
      </p>

      <section className="area-key-facts area-key-facts-three">
        <article>
          <span>SAFETY-RELATED</span>
          <strong>{safetyTotal.toLocaleString("en-GB")}</strong>
          <small>{monthLabel(latest.month)} · mapped categories</small>
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
          {top.length ? (
            <div className="category-list">
              {top.map((item) => (
                <div className="category-row" key={item.category}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {item.count.toLocaleString("en-GB")}
                      {safetyTotal > 0 ? ` · ${Math.round((item.count / safetyTotal) * 100)}%` : ""}
                    </small>
                  </div>
                  <div className="bar"><i style={{ width: `${Math.max(4, (item.count / (top[0]?.count || 1)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="notice">No mapped safety category is available for this snapshot.</div>
          )}
        </section>

        <section className="panel wide">
          <div className="panel-head">
            <div><span>TREND</span><h2>Recent safety-related months</h2></div>
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

      {otherTop.length ? (
        <section className="panel wide">
          <div className="panel-head">
            <div>
              <span>CONTEXT</span>
              <h2>Other recorded activity</h2>
            </div>
          </div>
          <p className="density-caution">
            These records are kept separate from the safety categories above. They can include emergency assistance, traffic, mediation and other non-crime police responses.
          </p>
          <div className="category-list">
            {otherTop.map((item) => (
              <div className="category-row" key={item.category}>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.count.toLocaleString("en-GB")}</small>
                </div>
                <div className="bar"><i style={{ width: `${Math.max(4, (item.count / (otherTop[0]?.count || 1)) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <small>{otherTotal.toLocaleString("en-GB")} non-safety source records in the latest snapshot.</small>
        </section>
      ) : null}

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
          <p><strong>Resident:</strong> {residentMethod}. The percentile compares this area only with other areas in {area.cityName}.</p>
          <p><strong>Visitor:</strong> {visitorMethod}. The percentile compares this area only with other areas in {area.cityName}.</p>
          <p><strong>Cross-city comparison:</strong> Resident and Visitor percentiles are local context indicators, not a common score for comparing Madrid with London.</p>
          <a href={area.sourceUrl} target="_blank" rel="noreferrer">Open the official source ↗</a>
        </div>
      </details>
    </main>
  );
}
