import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areaHref } from "@/lib/area-route";
import {
  type CitySlug,
  cityNames,
  getCityHarmTrends,
  getCityMapMetrics,
  getNeighbourhoods,
  monthLabel,
} from "@/lib/data";

export const revalidate = 43200;

type Props = { params: Promise<{ city: string }> };

function isCitySlug(value: string): value is CitySlug {
  return value === "london" || value === "madrid";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  if (!isCitySlug(city)) return { title: "City trends" };
  return {
    title: `${cityNames[city]} recorded harm trends`,
    description: `See which ${cityNames[city]} areas recorded the largest recent changes in the city-specific harm signal, using two three-month windows.`,
  };
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function TrendList({
  title,
  note,
  rows,
  areaName,
}: {
  title: string;
  note: string;
  rows: Array<{
    areaId: string;
    previousRatePer10k: number | null;
    recentRatePer10k: number | null;
    deltaRatePer10k: number | null;
    percentChange: number | null;
  }>;
  areaName: Map<string, string>;
}) {
  return (
    <section className="city-trend-block">
      <div className="city-trend-heading">
        <h2>{title}</h2>
        <p>{note}</p>
      </div>
      <div className="city-trend-table">
        {rows.length ? rows.map((row, index) => (
          <Link href={areaHref(row.areaId)} className="city-trend-row" key={row.areaId}>
            <span className="city-trend-rank">{String(index + 1).padStart(2, "0")}</span>
            <strong>{areaName.get(row.areaId) ?? row.areaId}</strong>
            <span>
              {row.previousRatePer10k?.toFixed(2) ?? "—"}
              <small> → </small>
              {row.recentRatePer10k?.toFixed(2) ?? "—"}
              <small> /10k</small>
            </span>
            <b>{row.deltaRatePer10k === null ? "—" : signed(row.deltaRatePer10k)}</b>
          </Link>
        )) : (
          <div className="notice">No material change is available for this window.</div>
        )}
      </div>
    </section>
  );
}

export default async function CityTrendsPage({ params }: Props) {
  const { city } = await params;
  if (!isCitySlug(city)) notFound();

  const areas = await getNeighbourhoods(city);
  const areaIds = areas.map((area) => area.id);
  const metrics = await getCityMapMetrics(city, areaIds);
  const trends = await getCityHarmTrends(city, areaIds, metrics);
  if (!trends) notFound();

  const areaName = new Map(areas.map((area) => [area.id, area.name]));
  const usable = trends.areas.filter(
    (row) => row.deltaRatePer10k !== null && Number.isFinite(row.deltaRatePer10k),
  );
  const decreases = usable
    .filter((row) => (row.deltaRatePer10k ?? 0) < -0.05)
    .sort((a, b) => (a.deltaRatePer10k ?? 0) - (b.deltaRatePer10k ?? 0))
    .slice(0, 12);
  const increases = usable
    .filter((row) => (row.deltaRatePer10k ?? 0) > 0.05)
    .sort((a, b) => (b.deltaRatePer10k ?? 0) - (a.deltaRatePer10k ?? 0))
    .slice(0, 12);

  return (
    <main className="method-page method-page-clean city-trends-page">
      <Link className="back" href={`/city/${city}`}>← {cityNames[city]} map</Link>
      <div className="eyebrow">Recorded trend · {cityNames[city]}</div>
      <h1>What changed recently?</h1>
      <p className="method-lead">
        This compares the average monthly <strong>{trends.signalLabel.toLowerCase()}</strong> rate
        in {monthLabel(trends.previousMonths[0])}–{monthLabel(trends.previousMonths.at(-1)!)} with
        {" "}{monthLabel(trends.recentMonths[0])}–{monthLabel(trends.recentMonths.at(-1)!)}.
      </p>

      <section className="method-limits city-trend-definition">
        <div>
          <span>SIGNAL</span>
          <h2>{trends.signalLabel}</h2>
        </div>
        <div>
          <p>Rates are shown per 10,000 residents and changes are ranked by the absolute rate difference, not by a universal safety score.</p>
          <p>Short windows can move because of reporting, isolated events, seasonality and normal month-to-month variation.</p>
          {city === "london" ? <p>London resident rates use the 2021 Census denominator currently available across all wards.</p> : null}
        </div>
      </section>

      <div className="city-trend-columns">
        <TrendList
          title="Largest recorded decreases"
          note="Lower recent rate than the preceding three-month window."
          rows={decreases}
          areaName={areaName}
        />
        <TrendList
          title="Largest recorded increases"
          note="Higher recent rate than the preceding three-month window."
          rows={increases}
          areaName={areaName}
        />
      </div>

      <p className="density-caution city-trend-disclaimer">
        A decrease does not mean an area became “safe”, and an increase does not mean it became “dangerous”.
        This is a descriptive change in one city-specific official-source signal, not a prediction of personal risk.
      </p>
    </main>
  );
}
