export const metadata = {
  title: "Methodology",
  description:
    "How dataSec turns official neighbourhood-level public-safety data into consistent Resident and Visitor views without pretending unlike city sources are identical.",
};

export default function MethodologyPage() {
  return (
    <main className="method-page method-page-clean">
      <div className="eyebrow">How dataSec works</div>
      <h1>One product language. Different official city sources.</h1>
      <p className="method-lead">
        dataSec keeps the interface consistent across cities while documenting the differences in what each official source actually measures.
      </p>

      <section className="method-core">
        <article>
          <span>01</span>
          <div>
            <h2>Official data first</h2>
            <p>
              London uses UK Police open data. Madrid uses Madrid Municipal Police dispatch data. Every snapshot is stored with its source, date and geographic boundary.
            </p>
          </div>
        </article>

        <article>
          <span>02</span>
          <div>
            <h2>Resident and Visitor everywhere</h2>
            <p>
              Every city exposes the same two primary views. Resident focuses on recurring residential exposure; Visitor focuses on short-stay street exposure, especially theft and robbery.
            </p>
          </div>
        </article>

        <article>
          <span>03</span>
          <div>
            <h2>Local scale, two ways to read it</h2>
            <p>
              Colours are relative within the same city and are also encoded as levels 1–5 for accessibility. Green/1 means a lower local signal; red/5 means a higher local signal. Neither is a guarantee or verdict.
            </p>
          </div>
        </article>

        <article>
          <span>04</span>
          <div>
            <h2>Comparable interface, honest methods</h2>
            <p>
              The filters are identical across cities, but the documented official implementation behind each filter can differ. Percentiles compare areas only inside their own city; dataSec does not create a fake Europe-wide ranking from unlike datasets.
            </p>
          </div>
        </article>
      </section>

      <section className="method-limits">
        <div>
          <span>IMPORTANT</span>
          <h2>What the map does not mean</h2>
        </div>
        <div>
          <p>Recorded incidents are not identical to personal risk or underlying victimisation.</p>
          <p>Central areas can appear high because of tourism, nightlife, transport and footfall.</p>
          <p>Resident denominators do not count visitors or commuters.</p>
          <p>Perception data, where used, is clearly identified and kept separate from incident records.</p>
          <p>Resident and Visitor percentiles from different cities must not be compared as if they shared one universal score.</p>
        </div>
      </section>

      <details className="method-technical">
        <summary>
          <span>Technical methodology</span>
          <small>Validation, geography, ingestion and health checks</small>
        </summary>
        <div className="method-technical-grid">
          <article>
            <h3>Source validation</h3>
            <p>Expected fields, category mappings, geography and unmatched-row thresholds are checked before observations are published.</p>
          </article>
          <article>
            <h3>Geography</h3>
            <p>Official area boundaries are stored and used for lookup and local comparison instead of relying on geocoder labels alone.</p>
          </article>
          <article>
            <h3>Publication health</h3>
            <p>
              Coverage, freshness, map geometry and core public-data queries are checked automatically before deployment.
              {" "}<a href="/status">See the latest public status check →</a>
            </p>
          </article>
          <article>
            <h3>Shared categories</h3>
            <p>Source-specific police labels are mapped into a common user-facing vocabulary. Non-crime responses such as emergency assistance or traffic are kept separate from safety-related categories.</p>
          </article>
        </div>
      </details>
    </main>
  );
}
