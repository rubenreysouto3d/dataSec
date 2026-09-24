import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { boundaryPath } from "@/lib/boundary";
import { areaIdFromPath, areaPathId } from "@/lib/area-route";
import {
  areaTypeLabel,
  dataLabel,
  getAreaContext,
  getAreaProfile,
  getBoundaryRings,
  getMonthlySummaries,
  getNeighbourhoods,
  monthLabel,
  sourceExplanation,
} from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

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

  try {
    area = await getAreaProfile(areaId);
    if (area) {
      [boundary, context, monthly] = await Promise.all([
        getBoundaryRings(area.id),
        getAreaContext(area.id),
        getMonthlySummaries(area.id, 6),
      ]);
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
        </div>
      </section>

      <section className="stat-strip">
        <article>
          <span>{dataLabel(area.citySlug)}</span>
          <strong>{latest.total.toLocaleString("en-GB")}</strong>
          <small>{monthLabel(latest.month)}</small>
        </article>
        <article>
          <span>Incident density</span>
          <strong>{context ? `${Math.round(context.incidentsPerKm2).toLocaleString("en-GB")}/km²` : "—"}</strong>
          <small>{context ? `P${Math.round(context.densityPercentile * 100)} within ${cityContext} · not risk` : "Context unavailable"}</small>
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
                <div><strong>{item.label}</strong><small>{item.count.toLocaleString("en-GB")}</small></div>
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
