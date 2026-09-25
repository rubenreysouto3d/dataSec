import Link from "next/link";
import { cityNames, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";

export const metadata = {
  title: "Data status",
  description: "Latest dataSec publication health check, source freshness and area coverage.",
};

function checkedLabel(value: string | null) {
  if (!value) return "Not verified in this local build";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default function StatusPage() {
  return (
    <main className="method-page method-page-clean">
      <Link className="back" href="/">← Home</Link>
      <div className="eyebrow">Publication health</div>
      <h1>{dataHealth.ok ? "Data checks passed." : "Local verification pending."}</h1>
      <p className="method-lead">
        Production is published only after automated checks confirm source freshness, area coverage,
        map geometry and point lookup for the current datasets.
      </p>

      <section className="method-limits">
        <div>
          <span>LAST SUCCESSFUL CHECK</span>
          <h2>{checkedLabel(dataHealth.checkedAt)}</h2>
        </div>
        <div>
          <p>
            A failed health check blocks the build instead of silently publishing stale or incomplete
            data.
          </p>
          <p>This page reports the same checks used by the deployment pipeline.</p>
        </div>
      </section>

      <section className="method-core">
        {dataHealth.cities.map((city) => (
          <article key={city.city}>
            <span>{city.coverageRatio >= 0.9 ? "OK" : "!"}</span>
            <div>
              <h2>{cityNames[city.city]}</h2>
              <p>
                Latest source month: <strong>{city.latestMonth ? monthLabel(city.latestMonth) : "—"}</strong>
                {" · "}
                {city.latestMonthCoverage.toLocaleString("en-GB")} of {city.areaCount.toLocaleString("en-GB")} areas covered
                {" · "}
                {(city.coverageRatio * 100).toFixed(1)}% coverage.
              </p>
            </div>
          </article>
        ))}
      </section>

      <details className="method-technical">
        <summary>
          <span>What is checked</span>
          <small>Build-blocking validation</small>
        </summary>
        <div className="method-technical-grid">
          <article>
            <h3>Freshness</h3>
            <p>The latest stored source month must be within the configured freshness window.</p>
          </article>
          <article>
            <h3>Coverage</h3>
            <p>At least 90% of active areas must have a valid latest-month context row.</p>
          </article>
          <article>
            <h3>Geometry</h3>
            <p>Official map-boundary coverage is checked before the public build is allowed to finish.</p>
          </article>
          <article>
            <h3>Location lookup</h3>
            <p>Known points in central London and Madrid must resolve to stable official area IDs.</p>
          </article>
        </div>
      </details>

      <p className="density-caution">
        dataSec describes recorded official-source context. It does not predict whether a specific person
        will experience harm and should not be treated as a guarantee of personal safety.
      </p>
    </main>
  );
}
