import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaHref } from "@/lib/area-route";
import {
  areaDisplayName,
  type CitySlug,
  cityNames,
  getCityMapMetrics,
  getCitySafetySignals,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";
import {
  buildVisitorPercentileMap,
  CITY_FILTER_METHODS,
} from "@/lib/map-filters";
import {
  bandNumber,
  metricForLayer,
  relativeBand,
} from "@/lib/map-view";

type Audience = "resident" | "visitor";
type Props = {
  params: Promise<{ city: string; audience: string }>;
};

function isCitySlug(value: string): value is CitySlug {
  return value === "london" || value === "madrid";
}

function isAudience(value: string): value is Audience {
  return value === "resident" || value === "visitor";
}

const audienceCopy: Record<Audience, {
  title: string;
  description: string;
  intro: string;
}> = {
  resident: {
    title: "Neighbourhood context for residents",
    description: "Compare neighbourhoods using the same Resident signal as the interactive map.",
    intro: "For people thinking about living in the city. The signal is local to this city and uses the best documented resident context currently available here.",
  },
  visitor: {
    title: "Neighbourhood context for visitors",
    description: "Compare neighbourhoods using the same Visitor signal as the interactive map.",
    intro: "For short stays and accommodation decisions. The signal weights theft and robbery more heavily and is designed to avoid treating resident population as the only exposure denominator.",
  },
};

export function generateStaticParams() {
  return [
    { city: "madrid", audience: "resident" },
    { city: "madrid", audience: "visitor" },
    { city: "london", audience: "resident" },
    { city: "london", audience: "visitor" },
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, audience } = await params;
  if (!isCitySlug(city) || !isAudience(audience)) return { title: "City context" };

  const cityName = cityNames[city];
  const audienceName = audience === "resident" ? "residents" : "visitors";
  return {
    title: `${cityName} neighbourhood safety context for ${audienceName}`,
    description:
      `Official local data for comparing ${cityName} neighbourhoods for ${audienceName}. Uses the same city-local ${audience} signal as the dataSec map, with methodology and limitations shown.`,
  };
}

export default async function CityAudiencePage({ params }: Props) {
  const { city, audience } = await params;
  if (!isCitySlug(city) || !isAudience(audience)) notFound();

  const areas = await getNeighbourhoods(city);
  const areaIds = areas.map((area) => area.id);
  const metrics = await getCityMapMetrics(city, areaIds);
  const safetySignals = await getCitySafetySignals(city, areaIds, metrics);

  const metricById = new Map(metrics.map((metric) => [metric.areaId, metric]));
  const safetyById = new Map(safetySignals.map((signal) => [signal.areaId, signal]));
  const visitorById = buildVisitorPercentileMap(metrics);

  const rows = areas
    .map((area) => {
      const selected =
        audience === "resident"
          ? metricForLayer(
              metricById.get(area.id),
              "contextual-overview",
              safetyById.get(area.id),
              visitorById.get(area.id),
            )
          : metricForLayer(
              metricById.get(area.id),
              "visitor-context",
              safetyById.get(area.id),
              visitorById.get(area.id),
            );
      return {
        area,
        percentile: selected.percentile,
        level: bandNumber(selected.percentile),
      };
    })
    .filter(
      (row): row is typeof row & { percentile: number; level: number } =>
        row.percentile !== null && row.level !== null && Number.isFinite(row.percentile),
    )
    .sort((a, b) => a.percentile - b.percentile);

  const latestMonth = metrics.reduce(
    (latest, metric) => (!latest || metric.month > latest ? metric.month : latest),
    "",
  );

  const method =
    audience === "visitor"
      ? "70% theft + robbery concentration + 30% violence + property concentration"
      : city === "madrid" && safetySignals.some((signal) => signal.contextualConcernPercentile !== null)
        ? "50% recent personal-harm percentile + 50% 2025 district night-safety perception percentile"
        : CITY_FILTER_METHODS[city].residentFallbackMethod;

  const copy = audienceCopy[audience];
  const mode = audience === "resident" ? "resident" : "visitor";

  return (
    <main className="method-page method-page-clean city-intent-page">
      <Link className="back" href={`/city/${city}?view=${audience}`}>
        ← {cityNames[city]} map
      </Link>

      <div className="eyebrow">
        {cityNames[city]} · {audience === "resident" ? "Resident" : "Visitor"} view
      </div>
      <h1>{copy.title}</h1>
      <p className="method-lead">{copy.intro}</p>

      <section className="method-limits city-intent-definition">
        <div>
          <span>ACTIVE METHOD</span>
          <h2>{audience === "resident" ? "Resident context" : "Visitor context"}</h2>
        </div>
        <div>
          <p>{method}.</p>
          <p>
            {latestMonth ? `Latest source snapshot: ${monthLabel(latestMonth)}. ` : ""}
            Levels and percentiles compare areas only inside {cityNames[city]}.
          </p>
        </div>
      </section>

      <div className="city-intent-actions">
        <Link className="city-intent-primary" href={`/city/${city}?view=${audience}`}>
          Open the interactive {audience} map →
        </Link>
        <Link href={`/city/${city}/${audience === "resident" ? "visitor" : "resident"}`}>
          Switch to {audience === "resident" ? "Visitor" : "Resident"} context
        </Link>
      </div>

      <section className="city-intent-bands" aria-label="Local five-level area groups">
        {[1, 2, 3, 4, 5].map((level) => {
          const bandRows = rows.filter((row) => row.level === level).slice(0, 16);
          if (!bandRows.length) return null;
          const label = relativeBand(
            bandRows[Math.floor(bandRows.length / 2)]?.percentile ?? null,
            mode,
          );

          return (
            <article className="city-intent-band" key={level}>
              <div className="city-intent-band-head">
                <span>LEVEL {level}/5</span>
                <h2>{label}</h2>
                <small>
                  {rows.filter((row) => row.level === level).length.toLocaleString("en-GB")} areas in this local band
                </small>
              </div>

              <div className="city-intent-area-list">
                {bandRows.map(({ area, percentile }) => (
                  <Link href={areaHref(area.id)} key={area.id}>
                    <strong>{areaDisplayName(area)}</strong>
                    <span>{Math.round(percentile * 100)}th percentile</span>
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <p className="density-caution city-intent-disclaimer">
        These groups describe a relative official-source signal, not whether an area is “safe” or “dangerous”.
        A lower level does not guarantee personal safety, and a higher level can reflect reporting, footfall,
        nightlife, transport activity and source methodology.
      </p>

      <div className="city-intent-footer-links">
        <Link href="/methodology">Methodology →</Link>
        <Link href="/disclaimer">Use and limitations →</Link>
        <Link href="/status">Data status →</Link>
      </div>
    </main>
  );
}
