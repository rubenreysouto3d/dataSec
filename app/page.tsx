import Link from "next/link";
import { getCitySnapshot, getNeighbourhoods, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";

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

  const cityCards = [
    {
      slug: "madrid",
      name: "Madrid",
      snapshot: madridSnapshot,
      count: areas.filter((area) => area.citySlug === "madrid").length,
    },
    {
      slug: "london",
      name: "London",
      snapshot: londonSnapshot,
      count: areas.filter((area) => area.citySlug === "london").length,
    },
  ] as const;

  const verificationLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(dataHealth.checkedAt),
      )
    : "pending";

  return (
    <main className="home-page home-page-v2">
      <section className="home-entry">
        <div className="home-entry-copy">
          <div className="eyebrow">Urban safety explorer</div>
          <h1>
            Pick a city.
            <br />
            <em>Read the map.</em>
          </h1>
          <p>Official local data, simplified for residents and visitors.</p>
        </div>

        {error ? (
          <div className="notice">The validated data store is temporarily unavailable.</div>
        ) : (
          <div className="home-city-choice" aria-label="Choose a city">
            {cityCards.map((city) => (
              <Link className="home-city-choice-card" href={`/city/${city.slug}`} key={city.slug}>
                <span className="home-city-choice-name">{city.name}</span>
                <span className="home-city-choice-meta">
                  <strong>{city.count.toLocaleString("en-GB")}</strong> areas
                  <i aria-hidden="true">·</i>
                  <strong>{city.snapshot ? monthLabel(city.snapshot.month) : "—"}</strong>
                </span>
                <b>Open map →</b>
              </Link>
            ))}
          </div>
        )}

        <div className="home-entry-note">
          <span>Official public sources</span>
          <span>Resident + visitor views</span>
          <Link href="/status">Data verified {verificationLabel}</Link>
          <Link href="/methodology">How the data works</Link>
        </div>
      </section>
    </main>
  );
}
