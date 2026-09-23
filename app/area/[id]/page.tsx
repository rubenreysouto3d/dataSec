import { notFound } from "next/navigation";
import { boundaryPath } from "@/lib/boundary";
import {
  getBoundary,
  getCrimesForBoundary,
  getLatestMonths,
  getNeighbourhood,
  monthLabel,
  summarizeCrimes,
} from "@/lib/police";

type Props = { params: Promise<{ id: string }> };

export default async function AreaPage({ params }: Props) {
  const { id } = await params;
  try {
    const [area, boundary, months] = await Promise.all([
      getNeighbourhood(id),
      getBoundary(id),
      getLatestMonths(6),
    ]);
    if (!area || boundary.length < 3) notFound();

    const monthly = await Promise.all(
      months.map(async (month) => ({ month, crimes: await getCrimesForBoundary(boundary, month) })),
    );
    const latest = monthly[0];
    const summary = summarizeCrimes(latest.crimes);
    const top = summary.slice(0, 6);
    const totals = monthly.map((item) => ({ month: item.month, total: item.crimes.length })).reverse();
    const first = totals[0]?.total ?? 0;
    const last = totals.at(-1)?.total ?? 0;
    const trend = first === 0 ? null : Math.round(((last - first) / first) * 100);
    const max = Math.max(...totals.map((item) => item.total), 1);
    const path = boundaryPath(boundary);

    return (
      <main className="area-page">
        <a className="back" href="/">← London</a>
        <section className="area-intro">
          <div>
            <div className="eyebrow">London · Metropolitan Police neighbourhood</div>
            <h1>{area.name}</h1>
            <p>Latest published month: <strong>{monthLabel(latest.month)}</strong>. Figures below are recorded street-level incidents inside an approximated police-neighbourhood boundary.</p>
          </div>
          <div className="freshness"><span>DATA STATUS</span><strong>Official / current</strong><small>Checked live from source</small></div>
        </section>

        <section className="stat-strip">
          <article><span>Recorded incidents</span><strong>{latest.crimes.length.toLocaleString("en-GB")}</strong><small>{monthLabel(latest.month)}</small></article>
          <article><span>6-month movement</span><strong>{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}</strong><small>Not a risk score</small></article>
          <article><span>Largest category</span><strong>{top[0]?.label ?? "—"}</strong><small>{top[0]?.count ?? 0} incidents</small></article>
        </section>

        <div className="content-grid">
          <section className="panel map-panel">
            <div className="panel-head"><div><span>AREA</span><h2>Police boundary</h2></div><small>Not a street-risk heatmap</small></div>
            <svg className="boundary" viewBox="0 0 700 360" role="img" aria-label={`Boundary of ${area.name}`}>
              <path d={path} />
            </svg>
            <p className="caption">Neighbourhood policing boundaries can change over time. Crime locations from the source are deliberately approximate.</p>
          </section>

          <section className="panel">
            <div className="panel-head"><div><span>LATEST MONTH</span><h2>Incident mix</h2></div></div>
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
            <div className="panel-head"><div><span>TREND</span><h2>Last six published months</h2></div><small>Raw recorded incidents</small></div>
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
            <p>These are police-recorded street-level incidents supplied by data.police.uk. Published locations are approximate, and recorded crime is not identical to underlying victimisation or personal risk.</p>
            <p>dataSec deliberately does not convert this prototype into a single safety score. Population, footfall and comparable city-wide distributions will be added before relative-risk labels are introduced.</p>
            <a href="https://data.police.uk/docs/" target="_blank" rel="noreferrer">Read the official API documentation ↗</a>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error(error);
    return (
      <main className="area-page">
        <a className="back" href="/">← London</a>
        <section className="error-card"><div className="eyebrow">Source unavailable</div><h1>We could not verify this area right now.</h1><p>dataSec does not substitute fabricated or cached figures when the official source request fails.</p></section>
      </main>
    );
  }
}
