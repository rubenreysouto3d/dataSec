"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { areaDisplayName, type Neighbourhood } from "@/lib/data";
import { getCompareProfile, type CompareProfile } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";

type Props = {
  areas: Neighbourhood[];
  sourceError: boolean;
};

export default function CompareClient({ areas, sourceError }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const a = searchParams.get("a") ?? "";
  const b = searchParams.get("b") ?? "";
  const [left, setLeft] = useState(a);
  const [right, setRight] = useState(b);
  const [profiles, setProfiles] = useState<[CompareProfile | null, CompareProfile | null]>([null, null]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const byId = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const leftArea = byId.get(left);
  const rightArea = byId.get(right);
  const sameCity =
    !left || !right || leftArea?.citySlug === rightArea?.citySlug;

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
    for (const area of areas.slice().sort((x, y) => x.name.localeCompare(y.name))) {
      const bucket = result.get(area.cityName) ?? [];
      bucket.push(area);
      result.set(area.cityName, bucket);
    }
    return result;
  }, [areas]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!left || !right || left === right || !sameCity) return;
    router.push(`/compare?a=${encodeURIComponent(left)}&b=${encodeURIComponent(right)}`);
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
      router.push(`/compare?a=${encodeURIComponent(right)}&b=${encodeURIComponent(left)}`);
    }
  }

  return (
    <>
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
      {!left ? (
        <div className="compare-start-hint">Choose Area A first.</div>
      ) : null}
      {loading ? <div className="notice">Loading official comparison…</div> : null}
      {failed ? <div className="notice">The comparison data could not be loaded.</div> : null}

      {!loading && profiles[0] && profiles[1] ? (
        <Comparison
          left={profiles[0]}
          right={profiles[1]}
          leftLabel={leftArea ? areaDisplayName(leftArea) : profiles[0].name}
          rightLabel={rightArea ? areaDisplayName(rightArea) : profiles[1].name}
        />
      ) : null}
    </>
  );
}

function densityBand(percentile: number) {
  if (percentile < 0.2) return "Among the lowest recorded densities";
  if (percentile < 0.4) return "Lower than most areas";
  if (percentile < 0.6) return "Around the city middle";
  if (percentile < 0.8) return "Higher than most areas";
  return "Among the highest recorded densities";
}

function differenceCopy(leftValue: number, rightValue: number, unit: string) {
  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return "Comparison unavailable";
  const high = Math.max(leftValue, rightValue);
  const low = Math.min(leftValue, rightValue);
  if (high === 0) return "Same recorded value";
  if (low === 0) return `${high.toLocaleString("en-GB")} ${unit} vs 0`;
  const pct = Math.round(((high - low) / low) * 100);
  if (pct < 5) return "Very similar recorded values";
  return `${pct}% higher on this measure`;
}

function Comparison({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: CompareProfile;
  right: CompareProfile;
  leftLabel: string;
  rightLabel: string;
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

  const densityContext =
    left.citySlug === "london"
      ? "police neighbourhoods"
      : "municipal neighbourhoods";

  const leftDensityPct = Math.round(left.densityPercentile * 100);
  const rightDensityPct = Math.round(right.densityPercentile * 100);
  const densityHigher = left.incidentsPerKm2 === right.incidentsPerKm2
    ? null
    : left.incidentsPerKm2 > right.incidentsPerKm2 ? leftLabel : rightLabel;

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
        <span>QUICK READ</span>
        <div>
          <strong>
            {densityHigher
              ? `${densityHigher} has the higher recorded density`
              : "Both areas have the same recorded density"}
          </strong>
          <p>{differenceCopy(left.incidentsPerKm2, right.incidentsPerKm2, "incidents/km²")}.</p>
        </div>
      </div>

      <div className="compare-metrics">
        <Metric label="Recorded incidents" left={left.total.toLocaleString("en-GB")} right={right.total.toLocaleString("en-GB")} />
        <Metric label="Area size" left={`${left.areaKm2.toFixed(2)} km²`} right={`${right.areaKm2.toFixed(2)} km²`} />
        <Metric label="Recorded density" left={`${Math.round(left.incidentsPerKm2).toLocaleString("en-GB")}/km²`} right={`${Math.round(right.incidentsPerKm2).toLocaleString("en-GB")}/km²`} />
      </div>

      <div className="compare-position">
        <article>
          <span>{leftLabel}</span>
          <strong>{densityBand(left.densityPercentile)}</strong>
          <div className="compare-position-track"><i style={{ width: `${leftDensityPct}%` }} /></div>
        </article>
        <article>
          <span>{rightLabel}</span>
          <strong>{densityBand(right.densityPercentile)}</strong>
          <div className="compare-position-track"><i style={{ width: `${rightDensityPct}%` }} /></div>
        </article>
      </div>

      <details className="compare-details">
        <summary>
          <span>Detailed incident mix</span>
          <small>Compare source categories side by side</small>
        </summary>
        <div className="compare-category-table">
          <div className="compare-row compare-row-head">
            <span>{leftLabel}</span><strong>Incident mix · {left.month}</strong><span>{rightLabel}</span>
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
          Bars compare recorded source incidents per km² across {left.cityName} {densityContext} for the same snapshot.
          Higher does not automatically mean more dangerous.
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
