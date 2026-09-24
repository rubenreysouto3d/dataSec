export const metadata = {
  title: "Methodology",
  description:
    "How dataSec validates, stores and interprets official neighbourhood-level incident data without collapsing unlike sources into one safety score.",
};

export default function MethodologyPage() {
  return (
    <main className="method-page">
      <div className="eyebrow">Methodology · v0.4</div>
      <h1>Useful context without pretending unlike datasets are the same.</h1>
      <section className="method-grid">
        <article>
          <span>01</span>
          <h2>Primary official sources</h2>
          <p>London uses UK Police open data. Madrid uses incidents handled by Madrid Municipal Police central dispatch. Both are stored as validated snapshots with source provenance.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Different concepts stay separate</h2>
          <p>London&apos;s source is police-recorded street-level crime. Madrid&apos;s source is broader and also includes traffic, assistance, public-space and administrative police responses. dataSec does not label them as equivalent crime rates.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Local context, not a universal score</h2>
          <p>Map colours are percentiles calculated only within the same city and source snapshot. Darker means a higher recorded level for the selected metric; it does not mean “dangerous”, and lighter does not mean “safe”. Cross-city source-density ranking is deliberately disabled.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Geography is explicit</h2>
          <p>Official area boundaries are stored with their source periods where available. Place search and browser location are matched against those stored boundaries rather than treating a geocoder label as the data geography.</p>
        </article>
        <article>
          <span>05</span>
          <h2>Quality gates before publication</h2>
          <p>Source contracts, expected fields, category mappings, geography and unmatched-row thresholds are checked before a source snapshot can write product observations. A rejected source snapshot is recorded as failed instead of being treated as valid data.</p>
        </article>
        <article>
          <span>06</span>
          <h2>Daily health checks</h2>
          <p>The public data layer is checked for stable area identities, latest-month coverage, plausible context values, coordinate lookup and freshness. Current coverage is expected to stay above 90% and data older than four calendar months fails the health check.</p>
        </article>
        <article>
          <span>07</span>
          <h2>Known publication boundary</h2>
          <p>Validated rows are currently persisted to Supabase in idempotent HTTP batches rather than one database transaction. Health checks detect incomplete coverage; run-scoped staging or a transactional database RPC is the next backend hardening step.</p>
        </article>
        <article>
          <span>08</span>
          <h2>Resident rates are optional context</h2>
          <p>Madrid can show selected categories per 10,000 registered residents using the municipal population register from the same month. This is not the default view because visitor-heavy centres can look artificially high when tourists, commuters and nightlife footfall are absent from the resident denominator.</p>
        </article>
        <article>
          <span>09</span>
          <h2>Exposure proxies stay labelled as proxies</h2>
          <p>Pedestrian counters and commercial-activity data can help explain central-area exposure, but they are not interchangeable with population. Sparse pedestrian sensors are not used as a citywide denominator. Madrid&apos;s monthly commercial census is monitored as a possible contextual layer, not yet treated as a risk denominator.</p>
        </article>
        <article>
          <span>10</span>
          <h2>No demographic shortcuts</h2>
          <p>dataSec does not infer safety from ethnicity, nationality or neighbourhood reputation. The product is based on documented public-source observations and explicit limitations.</p>
        </article>
      </section>
      <div className="source-box single">
        <p>Current prototype coverage: London Metropolitan Police neighbourhoods and Madrid municipal neighbourhoods. Name search, explicit place/address lookup, browser-location matching and same-city comparison are already available. Additional cities will be added only when their source definitions and geography can be represented honestly.</p>
      </div>
    </main>
  );
}
