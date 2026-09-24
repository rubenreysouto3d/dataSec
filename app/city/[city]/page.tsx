import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type CitySlug,
  cityNames,
  getCityAreaContexts,
  getCityBoundaries,
  getCityMapMetrics,
  getCitySnapshot,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import CityAreaExplorer from "./CityAreaExplorer";
import CityMap from "./CityMap";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!isCitySlug(city)) return { title: "City data" };

  const cityName = cityNames[city];
  const description =
    city === "london"
      ? "Explore Metropolitan Police neighbourhood incident data, local density context, source definitions and stored monthly history for London."
      : "Explore Madrid Municipal Police dispatch incident data by municipal neighbourhood, with local density context, source definitions and stored monthly history.";

  return {
    title: `${cityName} neighbourhood data`,
    description,
  };
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  if (!isCitySlug(city)) notFound();

  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];
  let snapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let contexts: Awaited<ReturnType<typeof getCityAreaContexts>> = [];
  let boundaries: Awaited<ReturnType<typeof getCityBoundaries>> = [];
  let mapMetrics: Awaited<ReturnType<typeof getCityMapMetrics>> = [];
  let error = false;
  try {
    areas = await getNeighbourhoods(city);
    const areaIds = areas.map((area) => area.id);
    [snapshot, contexts, boundaries, mapMetrics] = await Promise.all([
      getCitySnapshot(city, areaIds),
      getCityAreaContexts(city, areaIds),
      getCityBoundaries(areaIds),
      getCityMapMetrics(city, areaIds),
    ]);
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

      {!error ? (
        <section className="city-map-section">
          <CityMap
            citySlug={city}
            areas={areas}
            boundaries={boundaries}
            metrics={mapMetrics}
          />
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
          <CityAreaExplorer areas={areas} contexts={contexts} />
        )}
      </section>
    </main>
  );
}
