export default function MethodologyPage() {
  return (
    <main className="method-page">
      <div className="eyebrow">Methodology · v0.2</div>
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
          <p>Density percentiles are calculated only within the same city and source snapshot. They describe recorded incident concentration, not personal risk.</p>
        </article>
        <article>
          <span>04</span>
          <h2>Geography is versioned</h2>
          <p>Official area boundaries are stored alongside source periods where available. London source locations are anonymised; Madrid profiles use official municipal neighbourhood geometry.</p>
        </article>
        <article>
          <span>05</span>
          <h2>Fail closed</h2>
          <p>If a source changes schema, fails validation or cannot be matched to its expected geography, ingestion stops instead of silently publishing suspect figures.</p>
        </article>
        <article>
          <span>06</span>
          <h2>No demographic shortcuts</h2>
          <p>dataSec does not infer safety from ethnicity, nationality or neighbourhood reputation. The product is based on documented public-source observations and explicit limitations.</p>
        </article>
      </section>
      <div className="source-box single">
        <p>Current prototype coverage: London Metropolitan Police neighbourhoods and Madrid municipal neighbourhoods. Next work focuses on richer history, normal place/address lookup and additional cities without collapsing incompatible sources into one score.</p>
      </div>
    </main>
  );
}
