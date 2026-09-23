import { getNeighbourhoods } from "@/lib/police";

export default async function Home() {
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let error = false;
  try {
    areas = await getNeighbourhoods();
  } catch {
    error = true;
  }

  const featured = ["West End", "Soho", "Camden Town", "Brixton", "Shoreditch", "Notting Hill"];
  const picks = featured
    .map((name) => areas.find((area) => area.name.toLowerCase().includes(name.toLowerCase())))
    .filter(Boolean) as typeof areas;
  const visible = picks.length >= 3 ? picks : areas.slice(0, 12);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Official data · neighbourhood context</div>
        <h1>Know the area,<br /><em>not the reputation.</em></h1>
        <p className="hero-copy">
          dataSec turns official public-safety data into readable neighbourhood profiles, without pretending that one magic score can define a place.
        </p>
        <a className="primary" href="#areas">Explore London</a>
        <div className="hero-proof">
          <span><strong>Source</strong> data.police.uk</span>
          <span><strong>Update</strong> monthly</span>
          <span><strong>Method</strong> transparent</span>
        </div>
      </section>

      <section className="principles">
        <article><span>01</span><h2>Official first</h2><p>Primary public sources, linked and dated on every profile.</p></article>
        <article><span>02</span><h2>Context over labels</h2><p>Crime mix, trend and geography instead of simplistic “good/bad” neighbourhood rankings.</p></article>
        <article><span>03</span><h2>Comparable locally</h2><p>We compare like with like inside each city before attempting cross-country interpretation.</p></article>
      </section>

      <section className="areas-section" id="areas">
        <div className="section-heading">
          <div><div className="eyebrow">Prototype city</div><h2>London</h2></div>
          <p>Metropolitan Police neighbourhoods. Pick an area to load its latest official crime data.</p>
        </div>
        {error ? (
          <div className="notice">The official API is temporarily unavailable. The site fails closed rather than showing stale or invented figures.</div>
        ) : (
          <div className="area-grid">
            {visible.map((area) => (
              <a className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.id}>
                <span className="area-city">London</span>
                <h3>{area.name}</h3>
                <span className="arrow">View profile →</span>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
