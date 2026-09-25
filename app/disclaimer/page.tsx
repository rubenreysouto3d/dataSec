import Link from "next/link";

export const metadata = {
  title: "Data limitations and safety disclaimer",
  description:
    "How to interpret dataSec safely: official-source limitations, local comparisons and what the site does not predict.",
};

export default function DisclaimerPage() {
  return (
    <main className="method-page method-page-clean">
      <Link className="back" href="/">← Home</Link>
      <div className="eyebrow">Use and limitations</div>
      <h1>Context, not a safety guarantee.</h1>
      <p className="method-lead">
        dataSec organises official public records to make local patterns easier to understand.
        It does not predict whether a particular person will experience crime, harm or any other incident.
      </p>

      <section className="method-core">
        <article>
          <span>01</span>
          <div>
            <h2>Local comparison only</h2>
            <p>
              Resident, Visitor, colour bands, levels and percentiles compare areas inside the same city.
              Madrid and London use different official source systems and their numbers are not one universal score.
            </p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <h2>Recorded data has limits</h2>
            <p>
              Official records can be affected by reporting behaviour, anonymised locations, police practices,
              tourism, nightlife, commuting, source definitions and publication delays.
            </p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <h2>Low does not mean risk-free</h2>
            <p>
              A green area or low relative level can still contain incidents. A red area does not mean that every
              street or visit is unsafe. The map describes a relative signal, not an individual outcome.
            </p>
          </div>
        </article>
        <article>
          <span>04</span>
          <div>
            <h2>Not emergency or professional advice</h2>
            <p>
              Do not use dataSec instead of official emergency guidance, local authorities, law enforcement,
              accommodation providers or professional advice when a decision requires current situation-specific information.
            </p>
          </div>
        </article>
      </section>

      <section className="method-limits">
        <div>
          <span>TRANSPARENCY</span>
          <h2>Check the source and status.</h2>
        </div>
        <div>
          <p>
            Each area exposes its source and methodology, and the public status page reports the latest successful
            publication checks.
          </p>
          <p>
            <Link href="/methodology">Read the methodology →</Link>
            {" · "}
            <Link href="/status">Check data status →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
