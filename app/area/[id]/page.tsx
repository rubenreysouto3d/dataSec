import { notFound } from "next/navigation";
import { boundaryPath } from "@/lib/boundary";
import {
  getAreaProfile,
  getBoundaryRings,
  getMonthlySummaries,
  monthLabel,
} from "@/lib/data";

type Props = { params: Promise<{ id: string }> };

export default async function AreaPage({ params }: Props) {
  const { id } = await params;

  let area: Awaited<ReturnType<typeof getAreaProfile>> = null;
  let boundary: Awaited<ReturnType<typeof getBoundaryRings>> = null;
  let monthly: Awaited<ReturnType<typeof getMonthlySummaries>> = [];

  try {
    area = await getAreaProfile(id);
    if (area) {
      [boundary, monthly] = await Promise.all([
        getBoundaryRings(area.id),
        getMonthlySummaries(area.id, 6),
      ]);
    }
  } catch (error) {
    console.error(error);
    return (
      <main className="area-page">
        <a className="back" href="/">← London</a>
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

  return (
    <main className="area-page">
      <a className="back" href="/">← London</a>
      <section className="area-intro">
        <div>
          <div className="eyebrow">London · Metropolitan Police neighbourhood</div>
          <h1>{area.name}</h1>
          <p>
            Latest stored month: <strong>{monthLabel(latest.month)}</strong>. Figures below are
            police-recorded street-level incidents assigned to the official neighbourhood boundary
            published for the same month.
          </p>
        </div>
        <div className="freshness">
          <span>DATA STATUS</span>
          <strong>Official / stored</strong>
          <small>Validated monthly snapshot</small>
        </div>
      </section>

      <section className="stat-strip">
        <article>
          <span>Recorded incidents</span>
          <strong>{latest.total.toLocaleString("en-GB")}</strong>
          <small>{monthLabel(latest.month)}</small>
        </article>
        <article>
          <span>{totals.length >= 2 ? `${totals.length}-month movement` : "Trend history"}</span>
          <strong>{trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}</strong>
          <small>{totals.length >= 2 ? "Not a risk score" : "Builds with each monthly ingest"}</small>
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
            <div><span>AREA</span><h2>Police boundary</h2></div>
            <small>Not a street-risk heatmap</small>
          </div>
          <svg className="boundary" viewBox="0 0 700 360" role="img" aria-label={`Boundary of ${area.name}`}>
            <path d={path} />
          </svg>
          <p className="caption">
            Boundaries are versioned by source month. Published crime locations are deliberately approximate.
          </p>
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
          <div className="panel-head">
            <div><span>HISTORY</span><h2>Stored monthly snapshots</h2></div>
            <small>Raw recorded incidents</small>
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
          <p>
            These are police-recorded street-level incidents supplied by data.police.uk and stored by
            dataSec as a validated monthly snapshot. Published source locations are approximate, and
            recorded crime is not identical to underlying victimisation or personal risk.
          </p>
          <p>
            dataSec deliberately does not convert this prototype into a single safety score. Population,
            footfall and comparable city-wide distributions will be added before relative-risk labels are introduced.
          </p>
          <a href="https://data.police.uk/docs/" target="_blank" rel="noreferrer">Read the official source documentation ↗</a>
        </div>
      </section>
    </main>
  );
}
