export const metadata = {
  title: "Methodology",
  description:
    "How dataSec validates, stores and interprets official neighbourhood-level incident data without collapsing unlike sources into one safety score.",
};

export default function MethodologyPage() {
  return (
    <main className="method-page">
      <div className="eyebrow">Methodology · v0.5</div>
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
          <h2>One visual language, local comparisons</h2>
          <p>Every city uses the same green → yellow → red relative scale. Green means a lower signal and red a higher signal compared with other areas in that city. Colours are not guarantees of safety, and cross-city rankings remain disabled because source definitions differ.</p>
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
          <h2>Resident is a stable product filter</h2>
          <p>The Resident view exists in every city and means recurring residential exposure. The implementation uses the best official denominator and contextual signal available locally: Madrid can combine six-month personal-harm data with resident night-safety perception, while London uses resident-normalised recorded categories where appropriate.</p>
        </article>
        <article>
          <span>09</span>
          <h2>Visitor is a stable product filter</h2>
          <p>The Visitor view also exists in every city and represents short-stay street exposure. It prioritises theft and robbery concentration, with a smaller violence/property component, and deliberately avoids resident denominators because tourists and commuters are not represented in the resident population.</p>
        </article>
        <article>
          <span>10</span>
          <h2>Same filters in every city</h2>
          <p>Resident, Visitor, Violence + property, Theft + robbery, All crime-related and All source activity are a shared global filter catalog. New cities inherit the same controls automatically; only the documented source implementation behind each filter may differ.</p>
        </article>
        <article>
          <span>11</span>
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
