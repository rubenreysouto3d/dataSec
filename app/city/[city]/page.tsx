import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  type CitySlug,
  cityNames,
  getCityActivityContexts,
  getCityBoundaries,
  getCityMapMetrics,
  getCitySafetySignals,
  getCitySnapshot,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import CityAreaExplorer from "./CityAreaExplorer";
import CityMap from "./CityMap";

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ view?: string }>;
};

const cityCopy: Record<CitySlug, {
  source: string;
  caution: string;
}> = {
  london: {
    source: "Police-recorded street-level crime published through data.police.uk, assigned to the official policing boundary for the same source month.",
    caution: "Published crime locations are anonymised and approximate. High incident density in central areas can reflect footfall, nightlife and transport activity.",
  },
  madrid: {
    source: "Official municipal police dispatch incidents. This dataset is broader than crime and includes traffic, assistance, public-space and administrative responses.",
    caution: "Counts and density are not a personal-risk score. Central neighbourhoods can legitimately concentrate recorded incidents because of nightlife, tourism and footfall; resident-normalised rates can also overstate those same areas because visitors are not included in the resident denominator.",
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

  return {
    title: `${cityNames[city]} safety map`,
    description: `Explore neighbourhood-level official safety data for ${cityNames[city]} with consistent resident and visitor views.`,
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const [{ city }, query] = await Promise.all([params, searchParams]);
  if (!isCitySlug(city)) notFound();

  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];
  let snapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let boundaries: Awaited<ReturnType<typeof getCityBoundaries>> = [];
  let mapMetrics: Awaited<ReturnType<typeof getCityMapMetrics>> = [];
  let activityContexts: Awaited<ReturnType<typeof getCityActivityContexts>> = [];
  let safetySignals: Awaited<ReturnType<typeof getCitySafetySignals>> = [];
  let error = false;

  try {
    areas = await getNeighbourhoods(city);
    const areaIds = areas.map((area) => area.id);
    [snapshot, boundaries, mapMetrics, activityContexts] = await Promise.all([
      getCitySnapshot(city, areaIds),
      getCityBoundaries(areaIds),
      getCityMapMetrics(city, areaIds),
      city === "madrid" ? getCityActivityContexts(areaIds) : Promise.resolve([]),
    ]);
    safetySignals = await getCitySafetySignals(city, areaIds, mapMetrics);
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  const copy = cityCopy[city];
  const initialAudience = query.view === "visitor" ? "visitor" : "resident";

  return (
    <main className="city-page city-page-app">
      <section className="city-app-bar" aria-label="City explorer">
        <div className="city-switcher">
          <span>City</span>
          <Link href="/city/madrid" className={city === "madrid" ? "is-active" : ""}>Madrid</Link>
          <Link href="/city/london" className={city === "london" ? "is-active" : ""}>London</Link>
        </div>

        <div className="city-app-status">
          <strong>{cityNames[city]}</strong>
          {snapshot ? (
            <span>{snapshot.areaCount.toLocaleString("en-GB")} areas · {monthLabel(snapshot.month)}</span>
          ) : null}
        </div>
      </section>

      {!error ? (
        <section className="city-map-section city-map-section-app">
          <CityMap
            citySlug={city}
            areas={areas}
            boundaries={boundaries}
            metrics={mapMetrics}
            activityContexts={activityContexts}
            safetySignals={safetySignals}
            initialAudience={initialAudience}
          />
        </section>
      ) : (
        <div className="notice city-app-error">The stored dataset is temporarily unavailable.</div>
      )}

      <section className="city-secondary-tools">
        <details className="city-data-details">
          <summary>
            <span>About this data</span>
            <small>Source, limits and coverage</small>
          </summary>
          <div>
            <article>
              <span>SOURCE</span>
              <p>{copy.source}</p>
            </article>
            <article>
              <span>IMPORTANT LIMIT</span>
              <p>{copy.caution}</p>
            </article>
            <article>
              <span>MAP COVERAGE</span>
              <p>{boundaries.length} of {areas.length} stored areas have usable map geometry.</p>
            </article>
          </div>
        </details>

        <details className="city-area-browser">
          <summary>
            <span>All neighbourhoods</span>
            <small>{areas.length.toLocaleString("en-GB")} areas</small>
          </summary>
          <div className="city-area-browser-body">
            {error ? (
              <div className="notice">The stored dataset is temporarily unavailable.</div>
            ) : (
              <CityAreaExplorer areas={areas} />
            )}
          </div>
        </details>
        {!error ? (
          <>
            <div className="city-context-links">
              <Link href={`/city/${city}/resident`}>
                <span>Living here</span>
                <strong>Resident neighbourhood context →</strong>
                <small>Browse the same five-level Resident signal as the map.</small>
              </Link>
              <Link href={`/city/${city}/visitor`}>
                <span>Short stay</span>
                <strong>Visitor neighbourhood context →</strong>
                <small>Browse the same theft-weighted Visitor signal as the map.</small>
              </Link>
            </div>
            <Link className="city-trends-link" href={`/city/${city}/trends`}>
              <span>Recent change</span>
              <strong>Recorded harm trends →</strong>
              <small>Compare the latest 3 months with the previous 3.</small>
            </Link>
          </>
        ) : null}
      </section>
    </main>
  );
}
