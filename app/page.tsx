import Link from "next/link";
import { getCitySnapshot, getNeighbourhoods, monthLabel } from "@/lib/data";

export default async function Home() {
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let londonSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let madridSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let error = false;

  try {
    areas = await getNeighbourhoods();
    const londonIds = areas.filter((area) => area.citySlug === "london").map((area) => area.id);
    const madridIds = areas.filter((area) => area.citySlug === "madrid").map((area) => area.id);
    [londonSnapshot, madridSnapshot] = await Promise.all([
      getCitySnapshot("london", londonIds),
      getCitySnapshot("madrid", madridIds),
    ]);
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const cityCards = [
    {
      slug: "madrid",
      name: "Madrid",
      description: "Municipal neighbourhoods from official Madrid Municipal Police dispatch data.",
      snapshot: madridSnapshot,
      count: areas.filter((area) => area.citySlug === "madrid").length,
      examples: ["Sol", "Lavapiés", "San Diego", "San Cristóbal"],
    },
    {
      slug: "london",
      name: "London",
      description: "Metropolitan Police neighbourhoods from official police-recorded street-level crime data.",
      snapshot: londonSnapshot,
      count: areas.filter((area) => area.citySlug === "london").length,
      examples: ["West End", "Camden", "Brixton", "Shoreditch"],
    },
  ] as const;

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="eyebrow">Official urban safety data</div>
        <h1>
          Know an area
          <br />
          <em>before you go.</em>
        </h1>
        <p>Pick a city. Read the map. Check the neighbourhood.</p>

        <form className="search-form home-search" action={`${basePath}/search`} method="get">
          <label className="sr-only" htmlFor="area-search">Search a neighbourhood</label>
          <input id="area-search" name="q" placeholder="Search a neighbourhood…" autoComplete="off" />
          <button type="submit">Search</button>
        </form>

      </section>

      <section className="home-cities" id="areas">
        <div className="home-section-head">
          <div>
            <span>EXPLORE</span>
            <h2>Choose a city</h2>
          </div>
        </div>

        {error ? (
          <div className="notice">The validated data store is temporarily unavailable.</div>
        ) : (
          <div className="home-city-grid">
            {cityCards.map((city) => (
              <article className="home-city-card" key={city.slug}>
                <div className="home-city-top">
                  <div>
                    <span>LIVE CITY</span>
                    <h3>{city.name}</h3>
                  </div>
                  <Link href={`/city/${city.slug}`}>Open map →</Link>
                </div>
                <div className="home-city-meta">
                  <span><strong>{city.count.toLocaleString("en-GB")}</strong> areas</span>
                  <span><strong>{city.snapshot ? monthLabel(city.snapshot.month) : "—"}</strong> latest data</span>
                </div>

              </article>
            ))}
          </div>
        )}
      </section>


    </main>
  );
}
