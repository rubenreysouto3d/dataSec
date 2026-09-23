import Link from "next/link";
import { getNeighbourhoods } from "@/lib/data";
import LocateButton from "@/components/LocateButton";

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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Official data · neighbourhood context</div>
        <h1>Know the area,<br /><em>not the reputation.</em></h1>
        <p className="hero-copy">
          dataSec turns official public-safety data into readable neighbourhood profiles, without pretending that one magic score can define a place.
        </p>
        <form className="search-form" action={`${basePath}/search`} method="get">
          <label className="sr-only" htmlFor="area-search">Search a London neighbourhood</label>
          <input id="area-search" name="q" placeholder="Search London neighbourhoods…" autoComplete="off" />
          <button type="submit">Search</button>
        </form>
        <LocateButton />
        <div className="hero-proof">
          <span><strong>Source</strong> data.police.uk</span>
          <span><strong>Update</strong> monthly</span>
          <span><strong>Storage</strong> validated snapshots</span>
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
          <p>Metropolitan Police neighbourhoods backed by monthly official snapshots stored in dataSec.</p>
        </div>
        {error ? (
          <div className="notice">The data store is temporarily unavailable. dataSec fails closed rather than inventing figures.</div>
        ) : (
          <div className="area-grid">
            {visible.map((area) => (
              <Link className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.id}>
                <span className="area-city">London</span>
                <h3>{area.name}</h3>
                <span className="arrow">View profile →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
