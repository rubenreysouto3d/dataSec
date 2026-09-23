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

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const london = areas.filter((area) => area.citySlug === "london");
  const madrid = areas.filter((area) => area.citySlug === "madrid" && area.areaType === "municipal_neighbourhood");

  const londonFeatured = ["West End", "Camden Town", "Brixton", "Shoreditch"];
  const madridFeatured = ["Sol", "Malasaña", "Lavapiés", "Chueca"];

  const pick = (pool: typeof areas, names: string[]) =>
    names
      .map((name) => pool.find((area) => area.name.toLowerCase().includes(name.toLowerCase())))
      .filter(Boolean) as typeof areas;

  const londonVisible = pick(london, londonFeatured);
  const madridVisible = pick(madrid, madridFeatured);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Official data · local context</div>
        <h1>Know the area,<br /><em>not the reputation.</em></h1>
        <p className="hero-copy">
          dataSec turns official public-safety data into readable local profiles, while keeping each city&apos;s source and definitions separate.
        </p>
        <form className="search-form" action={`${basePath}/search`} method="get">
          <label className="sr-only" htmlFor="area-search">Search London or Madrid</label>
          <input id="area-search" name="q" placeholder="Search London or Madrid areas…" autoComplete="off" />
          <button type="submit">Search</button>
        </form>
        <LocateButton />
        <div className="hero-proof">
          <span><strong>Cities</strong> London · Madrid</span>
          <span><strong>Sources</strong> official public data</span>
          <span><strong>Storage</strong> validated snapshots</span>
        </div>
      </section>

      <section className="principles">
        <article><span>01</span><h2>Official first</h2><p>Primary public sources, linked and dated on every profile.</p></article>
        <article><span>02</span><h2>Context over labels</h2><p>Incident mix, trend and geography instead of simplistic “good/bad” rankings.</p></article>
        <article><span>03</span><h2>Comparable locally</h2><p>Each city is interpreted within its own source definitions before any broader comparison.</p></article>
      </section>

      <section className="areas-section" id="areas">
        <div className="section-heading">
          <div><div className="eyebrow">Live city</div><h2><Link href="/city/london">London</Link></h2></div>
          <p>Metropolitan Police neighbourhoods backed by monthly police-recorded street-level crime snapshots.</p>
        </div>
        {error ? (
          <div className="notice">The data store is temporarily unavailable. dataSec fails closed rather than inventing figures.</div>
        ) : (
          <div className="area-grid">
            {(londonVisible.length ? londonVisible : london.slice(0, 6)).map((area) => (
              <Link className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.stableId}>
                <span className="area-city">London</span>
                <h3>{area.name}</h3>
                <span className="arrow">View profile →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="areas-section city-secondary">
        <div className="section-heading">
          <div><div className="eyebrow">Live city</div><h2><Link href="/city/madrid">Madrid</Link></h2></div>
          <p>Official municipal neighbourhoods using incidents handled by Madrid Municipal Police central dispatch. This source is broader than crime.</p>
        </div>
        {!error ? (
          <div className="area-grid">
            {(madridVisible.length ? madridVisible : madrid.slice(0, 6)).map((area) => (
              <Link className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.stableId}>
                <span className="area-city">Madrid</span>
                <h3>{area.name}</h3>
                <span className="arrow">View profile →</span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
