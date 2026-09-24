import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type CitySlug,
  cityNames,
  getCitySnapshot,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";

type Props = { params: Promise<{ city: string }> };

const cityCopy: Record<CitySlug, {
  eyebrow: string;
  intro: string;
  source: string;
  caution: string;
}> = {
  london: {
    eyebrow: "UK Police open data",
    intro: "Metropolitan Police neighbourhoods with stored monthly street-level crime snapshots.",
    source: "Police-recorded street-level crime published through data.police.uk, assigned to the official policing boundary for the same source month.",
    caution: "Published crime locations are anonymised and approximate. High incident density in central areas can reflect footfall, nightlife and transport activity.",
  },
  madrid: {
    eyebrow: "Madrid Municipal Police",
    intro: "Municipal neighbourhoods with incidents handled by Madrid Municipal Police central dispatch.",
    source: "Official municipal police dispatch incidents. This dataset is broader than crime and includes traffic, assistance, public-space and administrative responses.",
    caution: "Counts and density must not be interpreted as a crime rate or compared directly with London because the source definitions are different.",
  },
};

function isCitySlug(value: string): value is CitySlug {
  return value === "london" || value === "madrid";
}

export function generateStaticParams() {
  return [{ city: "london" }, { city: "madrid" }];
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  if (!isCitySlug(city)) notFound();

  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];
  let snapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let error = false;
  try {
    areas = await getNeighbourhoods(city);
    snapshot = await getCitySnapshot(city, areas.map((area) => area.id));
  } catch {
    error = true;
  }

  const copy = cityCopy[city];

  return (
    <main className="city-page">
      <Link className="back" href="/">← Home</Link>

      <section className="city-intro">
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1>{cityNames[city]}</h1>
        <p>{copy.intro}</p>
      </section>

      <section className="city-source-note">
        <article>
          <span>WHAT THE SOURCE MEASURES</span>
          <p>{copy.source}</p>
        </article>
        <article>
          <span>IMPORTANT LIMITATION</span>
          <p>{copy.caution}</p>
        </article>
      </section>

      {snapshot ? (
        <section className="stat-strip">
          <article>
            <span>Areas in scope</span>
            <strong>{snapshot.areaCount.toLocaleString("en-GB")}</strong>
            <small>Stored official neighbourhoods</small>
          </article>
          <article>
            <span>Latest stored snapshot</span>
            <strong>{monthLabel(snapshot.month)}</strong>
            <small>Newest month available across this city</small>
          </article>
          <article>
            <span>Median source density</span>
            <strong>{Math.round(snapshot.medianIncidentsPerKm2).toLocaleString("en-GB")}/km²</strong>
            <small>Median across covered areas · descriptive only</small>
          </article>
          <article>
            <span>Snapshot coverage</span>
            <strong>{Math.round((snapshot.coveredAreaCount / snapshot.areaCount) * 100)}%</strong>
            <small>{snapshot.coveredAreaCount} of {snapshot.areaCount} areas on the latest month</small>
          </article>
        </section>
      ) : null}

      <section className="areas-section city-area-list">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Stored official areas</div>
            <h2>{areas.length.toLocaleString("en-GB")}</h2>
          </div>
          <p>Select an area to see its latest snapshot, source mix, density context and stored history.</p>
        </div>

        {error ? (
          <div className="notice">The stored dataset is temporarily unavailable.</div>
        ) : (
          <div className="area-grid">
            {areas.map((area) => (
              <Link className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.stableId}>
                <span className="area-city">{area.cityName}</span>
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
