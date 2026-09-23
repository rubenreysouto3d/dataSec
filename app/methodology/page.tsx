export default function MethodologyPage() {
  return (
    <main className="method-page">
      <div className="eyebrow">Methodology · v0.1</div>
      <h1>Useful context without pretending the data is perfect.</h1>
      <section className="method-grid">
        <article><span>01</span><h2>Primary sources</h2><p>The London prototype reads directly from data.police.uk, the official open-data service for policing data in England, Wales and Northern Ireland.</p></article>
        <article><span>02</span><h2>Approximate locations</h2><p>Street-level crime coordinates are anonymised by the source. We never present a plotted point as the exact location of an incident.</p></article>
        <article><span>03</span><h2>No universal score</h2><p>Different countries publish different concepts at different spatial and temporal resolutions. Cross-city scoring is withheld until metrics are genuinely comparable.</p></article>
        <article><span>04</span><h2>Fail closed</h2><p>If a source changes schema or fails validation, an update should stop rather than silently publishing suspect data.</p></article>
      </section>
      <div className="source-box single"><p>Next milestones: city-relative percentiles, population and footfall context, persistent ingestion with source-version tracking, then Madrid as the second incompatible data source.</p></div>
    </main>
  );
}
