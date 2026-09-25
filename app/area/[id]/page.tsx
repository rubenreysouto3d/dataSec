import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boundaryPath } from "@/lib/boundary";
import { areaIdFromPath, areaPathId } from "@/lib/area-route";
import { buildVisitorPercentileMap, CITY_FILTER_METHODS } from "@/lib/map-filters";
import {
  areaTypeLabel,
  dataLabel,
  getAreaContext,
  getAreaProfile,
  getBoundaryRings,
  getCityMapMetrics,
  getCitySafetySignals,
  getMonthlySummaries,
  getNeighbourhoods,
  monthLabel,
  sourceExplanation,
} from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

function densityBand(percentile: number | null | undefined) {
  if (percentile === null || percentile === undefined || !Number.isFinite(percentile)) {
    return "City comparison unavailable";
  }
  if (percentile < 0.2) return "Among the lowest recorded densities";
  if (percentile < 0.4) return "Lower than most areas";
  if (percentile < 0.6) return "Around the city middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "Among the highest recorded densities";
}

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
  let boundary: Awaited<ReturnType<typeof getBoundaryRings>> = null;
  let context: Awaited<ReturnType<typeof getAreaContext>> = null;
  let monthly: Awaited<ReturnType<typeof getMonthlySummaries>> = [];
  let cityMapMetrics: Awaited<ReturnType<typeof getCityMapMetrics>> = [];
  let safetySignals: Awaited<ReturnType<typeof getCitySafetySignals>> = [];

  try {
    area = await getAreaProfile(areaId);
    if (area) {
      const [nextBoundary, nextContext, nextMonthly, allAreas] = await Promise.all([
        getBoundaryRings(area.id),
        getAreaContext(area.id),
        getMonthlySummaries(area.id, 6),
        getNeighbourhoods(),
      ]);
      boundary = nextBoundary;
      context = nextContext;
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

  if (!area || !boundary || monthly.length === 0) notFound();

  const latest = monthly[0];
  const top = latest.categories.slice(0, 6);
  const totals = monthly
    .map((item) => ({ month: item.month, total: item.total }))
    .reverse();
  const first = totals[0]?.total ?? 0;
  const last = totals.at(-1)?.total ?? 0;
  const trend = totals.length < 2 || first === 0 ? null : Math.round(((last - first) / first) * 100);
  const max = Math.max(...totals.map((item) => item.total), 1);
  const path = boundaryPath(boundary.rings);
  const cityContext = area.citySlug === "london" ? "London police neighbourhoods" : "Madrid municipal neighbourhoods";
  const densityPosition = context ? Math.round(context.densityPercentile * 100) : null;
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
      <section className="area-intro">
        <div>
          <div className="eyebrow">{area.cityName} · {areaTypeLabel(area)}</div>
          <h1>{area.name}</h1>
          <p>
            Latest stored month: <strong>{monthLabel(latest.month)}</strong>. {sourceExplanation(area)}
          </p>
        </div>
        <div className="freshness">
          <span>DATA STATUS</span>
          <strong>Official / stored</strong>
          <small>Validated source snapshot</small>
          <Link className="area-compare-link" href={`/compare?a=${encodeURIComponent(area.id)}`}>
            Compare with another area →
          </Link>
        </div>
      </section>

      <section className="area-perspectives">
        <div className="area-perspectives-title">
          <span>SAME CITY FILTERS</span>
          <h2>Resident or visitor?</h2>
          <p>The same two views used on every city map, applied to this area.</p>
        </div>
        <article>
          <span>RESIDENT</span>
          <strong>{signalBand(residentPercentile)}</strong>
          <p>{residentMethod}.</p>
          {cityMetric?.population ? (
            <small>{methods.residentPopulationLabel}: {cityMetric.population.toLocaleString("en-GB")}</small>
          ) : null}
        </article>
        <article>
          <span>VISITOR</span>
          <strong>{signalBand(visitorPercentile)}</strong>
          <p>{visitorMethod}.</p>
          {cityMetric ? (
            <small>
              Theft + robbery: {signalBand(cityMetric.theftDensityPercentile)} · Violence + property: {signalBand(cityMetric.violencePropertyDensityPercentile)}
            </small>
          ) : null}
        </article>
      </section>

      <section className="area-glance">
        <div className="area-glance-title">
          <span>AT A GLANCE</span>
          <h2>What stands out here?</h2>
        </div>
        <article>
          <span>Recorded density</span>
          <strong>{densityBand(context?.densityPercentile)}</strong>
          <p>
            {context && densityPosition !== null
              ? `About ${densityPosition}% of ${cityContext} recorded a lower all-source density in the same snapshot.`
              : "City-relative context is unavailable for this snapshot."}
          </p>
        </article>
        <article>
          <span>Recent movement</span>
          <strong>{movementCopy(trend)}</strong>
          <p>Based only on the {totals.length} stored monthly snapshots currently available.</p>
        </article>
        <article>
          <span>Largest category</span>
          <strong>{top[0]?.label ?? "No category data"}</strong>
          <p>
            {top[0]
              ? `${top[0].count.toLocaleString("en-GB")} records${topShare !== null ? ` · about ${topShare}% of this snapshot` : ""}.`
              : "No category mix is available."}
          </p>
        </article>
      </section>

      <section className="stat-strip">
        <article>
          <span>{dataLabel(area.citySlug)}</span>
          <strong>{latest.total.toLocaleString("en-GB")}</strong>
          <small>{monthLabel(latest.month)}</small>
        </article>
        <article>
          <span>Recorded density</span>
          <strong>{context ? `${Math.round(context.incidentsPerKm2).toLocaleString("en-GB")}/km²` : "—"}</strong>
          <small>{context ? densityBand(context.densityPercentile) : "Context unavailable"}</small>
        </article>
        <article>
          <span>{totals.length >= 2 ? `${totals.length}-month movement` : "Trend history"}</span>
          <strong>{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}</strong>
          <small>{totals.length >= 2 ? "Not a risk score" : "Builds with each source ingest"}</small>
        </article>
        <article>
          <span>Largest category</span>
          <strong>{top[0]?.label ?? "—"}</strong>
          <small>{top[0]?.count.toLocaleString("en-GB") ?? 0} incidents</small>
        </article>
      </section>

      <div className="content-grid">
        <section className="panel map-panel">
          <div className="panel-head">
            <div><span>AREA</span><h2>Official boundary</h2></div>
            <small>Not a street-risk heatmap</small>
          </div>
          <svg className="boundary" viewBox="0 0 700 360" role="img" aria-label={`Boundary of ${area.name}`}>
            <path d={path} />
          </svg>
          <p className="caption">
            Boundaries are stored with the source snapshot and are used to keep geographic comparisons internally consistent.
          </p>
        </section>

        <section className="panel">
          <div className="panel-head"><div><span>LATEST SNAPSHOT</span><h2>Incident mix</h2></div></div>
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
            <div><span>HISTORY</span><h2>Stored snapshots</h2></div>
            <small>Raw source incident counts</small>
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

      <section className="source-box">
        <div><div className="eyebrow">Source & limitations</div><h2>What this page actually says</h2></div>
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
          <p>
            dataSec deliberately keeps each city&apos;s official definitions separate instead of forcing unlike datasets into one Europe-wide score.
          </p>
          <a href={area.sourceUrl} target="_blank" rel="noreferrer">Open the official source ↗</a>
        </div>
      </section>
    </main>
  );
}
