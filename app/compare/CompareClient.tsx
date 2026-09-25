"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  areaDisplayName,
  type CityMapMetric,
  type CitySafetySignal,
  type Neighbourhood,
} from "@/lib/data";
import {
  buildVisitorPercentileMap,
} from "@/lib/map-filters";
import {
  bandMode,
  bandNumber,
  isMapLayerKey,
  mapLayerLabel,
  metricForLayer,
  metricKeyForLayer,
  relativeBand,
  type MapLayerKey,
  type MapLayerMetric,
} from "@/lib/map-view";
import { getCompareProfile, type CompareProfile } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";

type Props = {
  areas: Neighbourhood[];
  metrics: CityMapMetric[];
  safetySignals: CitySafetySignal[];
  sourceError: boolean;
};

const LAYER_OPTIONS: Array<{ value: MapLayerKey; label: string }> = [
  { value: "contextual-overview", label: "Resident context" },
  { value: "visitor-context", label: "Visitor context" },
  { value: "violence-property", label: "Violence + property · per km²" },
  { value: "violence-property-resident", label: "Violence + property · per 10,000 residents" },
  { value: "theft", label: "Theft + robbery · per km²" },
  { value: "theft-resident", label: "Theft + robbery · per 10,000 residents" },
  { value: "crime-related", label: "All crime-related · per km²" },
  { value: "crime-related-resident", label: "All crime-related · per 10,000 residents" },
  { value: "activity", label: "All source activity · per km²" },
];

function compareHref(a: string, b: string, layer: MapLayerKey) {
  const params = new URLSearchParams();
  if (a) params.set("a", a);
  if (b) params.set("b", b);
  params.set("layer", layer);
  return `/compare?${params.toString()}`;
}

function percentileLabel(percentile: number | null) {
  if (percentile === null || !Number.isFinite(percentile)) return "Unavailable";
  return `${Math.round(percentile * 100)}th percentile`;
}

function formatLayerValue(metric: MapLayerMetric) {
  if (metric.value === null || !Number.isFinite(metric.value)) return "—";
  return `${metric.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${metric.unit}`;
}

export default function CompareClient({
  areas,
  metrics,
  safetySignals,
  sourceError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const a = searchParams.get("a") ?? "";
  const b = searchParams.get("b") ?? "";
  const requestedLayer = searchParams.get("layer");
  const layer: MapLayerKey = isMapLayerKey(requestedLayer)
    ? requestedLayer
    : "contextual-overview";

  const [left, setLeft] = useState(a);
  const [right, setRight] = useState(b);
  const [profiles, setProfiles] = useState<[CompareProfile | null, CompareProfile | null]>([
    null,
    null,
  ]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const byId = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const metricById = useMemo(
    () => new Map(metrics.map((metric) => [metric.areaId, metric])),
    [metrics],
  );
  const safetyById = useMemo(
    () => new Map(safetySignals.map((signal) => [signal.areaId, signal])),
    [safetySignals],
  );
  const visitorById = useMemo(() => {
    const result = new Map<string, number>();
    for (const citySlug of ["london", "madrid"] as const) {
      const cityMetrics = metrics.filter((metric) => metric.citySlug === citySlug);
      for (const [areaId, percentile] of buildVisitorPercentileMap(cityMetrics)) {
        result.set(areaId, percentile);
      }
    }
    return result;
  }, [metrics]);

  const leftArea = byId.get(left);
  const rightArea = byId.get(right);
  const sameCity = !left || !right || leftArea?.citySlug === rightArea?.citySlug;

  const signalFor = (areaId: string) =>
    metricForLayer(
      metricById.get(areaId),
      layer,
      safetyById.get(areaId),
      visitorById.get(areaId),
    );

  const leftSignal = left ? signalFor(left) : null;
  const rightSignal = right ? signalFor(right) : null;

  useEffect(() => {
    setLeft(a);
    setRight(b);
    const leftArea = byId.get(a);
    const rightArea = byId.get(b);
    if (!a || !b || !leftArea || !rightArea || leftArea.citySlug !== rightArea.citySlug) {
      setProfiles([null, null]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([getCompareProfile(a), getCompareProfile(b)])
      .then((result) => {
        if (!cancelled) setProfiles(result as [CompareProfile | null, CompareProfile | null]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a, b, byId]);

  const grouped = useMemo(() => {
    const result = new Map<string, Neighbourhood[]>();
    for (const area of areas.slice().sort((x, y) => areaDisplayName(x).localeCompare(areaDisplayName(y)))) {
      const bucket = result.get(area.cityName) ?? [];
      bucket.push(area);
      result.set(area.cityName, bucket);
    }
    return result;
  }, [areas]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!left || !right || left === right || !sameCity) return;
    router.push(compareHref(left, right, layer));
  }

  function changeLayer(nextLayer: MapLayerKey) {
    router.push(compareHref(left, right, nextLayer));
  }

  if (sourceError) {
    return <div className="notice">The stored area list could not be loaded.</div>;
  }

  const options = (placeholder: string, citySlug?: string, excludedId?: string) => (
    <>
      <option value="">{placeholder}</option>
      {[...grouped.entries()].map(([city, cityAreas]) => {
        const filteredAreas = cityAreas.filter(
          (area) => (!citySlug || area.citySlug === citySlug) && area.id !== excludedId,
        );
        if (!filteredAreas.length) return null;
        return (
          <optgroup label={city} key={city}>
            {filteredAreas.map((area) => (
              <option value={area.id} key={area.stableId}>{areaDisplayName(area)}</option>
            ))}
          </optgroup>
        );
      })}
    </>
  );

  function changeLeft(value: string) {
    setLeft(value);
    const nextLeft = byId.get(value);
    const currentRight = byId.get(right);
    if (nextLeft && currentRight && nextLeft.citySlug !== currentRight.citySlug) {
      setRight("");
    }
  }

  function swapAreas() {
    setLeft(right);
    setRight(left);
    if (left && right) {
      router.push(compareHref(right, left, layer));
    }
  }

  return (
    <>
      <div className="compare-view-control">
        <label>
          <span>Compare using</span>
          <select
            value={layer}
            onChange={(event) => changeLayer(event.target.value as MapLayerKey)}
          >
            {LAYER_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <small>
          Uses the same city-local signal as the map. Changing this control never creates a cross-city score.
        </small>
      </div>

      <form className="compare-form" onSubmit={submit}>
        <label>
          <span>Area A</span>
          <select value={left} onChange={(event) => changeLeft(event.target.value)}>
            {options("Choose area…", undefined, right)}
          </select>
        </label>
        <button
          className="compare-swap"
          type="button"
          onClick={swapAreas}
          disabled={!left || !right}
          aria-label="Swap compared areas"
          title="Swap areas"
        >
          ⇄
        </button>
        <label>
          <span>Area B</span>
          <select value={right} onChange={(event) => setRight(event.target.value)}>
            {options(
              leftArea ? `Choose another ${leftArea.cityName} area…` : "Choose area…",
              leftArea?.citySlug,
              left,
            )}
          </select>
        </label>
        <button type="submit" disabled={!left || !right || left === right || !sameCity}>Compare</button>
      </form>

      {left === right && left ? <div className="notice">Choose two different areas.</div> : null}
      {!left ? <div className="compare-start-hint">Choose Area A first.</div> : null}
      {loading ? <div className="notice">Loading official comparison…</div> : null}
      {failed ? <div className="notice">The comparison data could not be loaded.</div> : null}

      {!loading &&
      profiles[0] &&
      profiles[1] &&
      leftSignal &&
      rightSignal &&
      leftArea &&
      rightArea ? (
        <Comparison
          left={profiles[0]}
          right={profiles[1]}
          leftSignal={leftSignal}
          rightSignal={rightSignal}
          leftLabel={areaDisplayName(leftArea)}
          rightLabel={areaDisplayName(rightArea)}
          layer={layer}
        />
      ) : null}
    </>
  );
}

function Comparison({
  left,
  right,
  leftSignal,
  rightSignal,
  leftLabel,
  rightLabel,
  layer,
}: {
  left: CompareProfile;
  right: CompareProfile;
  leftSignal: MapLayerMetric;
  rightSignal: MapLayerMetric;
  leftLabel: string;
  rightLabel: string;
  layer: MapLayerKey;
}) {
  const categories = Array.from(new Set([
    ...left.categories.slice(0, 7).map((item) => item.slug),
    ...right.categories.slice(0, 7).map((item) => item.slug),
  ]));

  const labelFor = (slug: string) =>
    left.categories.find((item) => item.slug === slug)?.label ??
    right.categories.find((item) => item.slug === slug)?.label ??
    slug;

  const valueFor = (profile: CompareProfile, slug: string) =>
    profile.categories.find((item) => item.slug === slug)?.count ?? 0;

  const mode = bandMode(metricKeyForLayer(layer));
  const leftPercentile = leftSignal.percentile;
  const rightPercentile = rightSignal.percentile;
  const leftPct = leftPercentile === null ? null : Math.round(leftPercentile * 100);
  const rightPct = rightPercentile === null ? null : Math.round(rightPercentile * 100);
  const sameRelativePosition =
    leftPercentile !== null &&
    rightPercentile !== null &&
    Math.abs(leftPercentile - rightPercentile) < 0.01;
  const higherLabel =
    leftPercentile === null || rightPercentile === null || sameRelativePosition
      ? null
      : leftPercentile > rightPercentile
        ? leftLabel
        : rightLabel;

  return (
    <section className="compare-results">
      <div className="compare-head">
        <div>
          <span>AREA A · {left.cityName}</span>
          <h2>{leftLabel}</h2>
          <Link href={areaHref(left.id)}>Open full profile →</Link>
        </div>
        <div>
          <span>AREA B · {right.cityName}</span>
          <h2>{rightLabel}</h2>
          <Link href={areaHref(right.id)}>Open full profile →</Link>
        </div>
      </div>

      <div className="compare-takeaway compare-takeaway-clean">
        <span>{mapLayerLabel(layer).toUpperCase()}</span>
        <div>
          <strong>
            {higherLabel
              ? `${higherLabel} has the higher relative signal on this view`
              : sameRelativePosition
                ? "Both areas are at almost the same relative position"
                : "A relative comparison is unavailable for one of these areas"}
          </strong>
          <p>
            This compares the same {mapLayerLabel(layer).toLowerCase()} signal used on the {left.cityName} map.
          </p>
        </div>
      </div>

      <div className="compare-metrics">
        <Metric
          label="Local level"
          left={bandNumber(leftPercentile) ? `Level ${bandNumber(leftPercentile)}/5` : "—"}
          right={bandNumber(rightPercentile) ? `Level ${bandNumber(rightPercentile)}/5` : "—"}
        />
        <Metric
          label="City position"
          left={percentileLabel(leftPercentile)}
          right={percentileLabel(rightPercentile)}
        />
        {(leftSignal.value !== null || rightSignal.value !== null) ? (
          <Metric
            label="Recorded value"
            left={formatLayerValue(leftSignal)}
            right={formatLayerValue(rightSignal)}
          />
        ) : null}
      </div>

      <div className="compare-position">
        <article>
          <span>{leftLabel}</span>
          <strong>{relativeBand(leftPercentile, mode)}</strong>
          <p>{leftPct === null ? "No local percentile" : `${leftPct}th percentile within ${left.cityName}`}</p>
          <div className="compare-position-track">
            <i style={{ width: `${leftPct ?? 0}%` }} />
          </div>
        </article>
        <article>
          <span>{rightLabel}</span>
          <strong>{relativeBand(rightPercentile, mode)}</strong>
          <p>{rightPct === null ? "No local percentile" : `${rightPct}th percentile within ${right.cityName}`}</p>
          <div className="compare-position-track">
            <i style={{ width: `${rightPct ?? 0}%` }} />
          </div>
        </article>
      </div>

      <details className="compare-details">
        <summary>
          <span>Detailed source incident mix</span>
          <small>Raw recorded categories, separate from the selected comparison signal</small>
        </summary>
        <div className="compare-category-table">
          <div className="compare-row compare-row-head">
            <span>{leftLabel}</span><strong>Source mix · {left.month}</strong><span>{rightLabel}</span>
          </div>
          {categories.map((slug) => (
            <div className="compare-row" key={slug}>
              <span>{valueFor(left, slug).toLocaleString("en-GB")}</span>
              <strong>{labelFor(slug)}</strong>
              <span>{valueFor(right, slug).toLocaleString("en-GB")}</span>
            </div>
          ))}
        </div>
      </details>

      <details className="compare-note compare-note-details">
        <summary>How to read this comparison</summary>
        <p>
          The primary comparison above uses the same {mapLayerLabel(layer).toLowerCase()} definition as the city map.
          Percentiles and levels are local to {left.cityName}; they are not a Europe-wide safety score and do not predict personal risk.
        </p>
      </details>
    </section>
  );
}

function Metric({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="compare-metric">
      <strong>{left}</strong>
      <span>{label}</span>
      <strong>{right}</strong>
    </div>
  );
}
