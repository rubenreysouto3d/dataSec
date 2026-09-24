"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Neighbourhood } from "@/lib/data";
import { getCompareProfile, type CompareProfile } from "@/lib/public-data-client";

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
  const sameCity =
    !left || !right || byId.get(left)?.citySlug === byId.get(right)?.citySlug;

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

  const options = (placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {[...grouped.entries()].map(([city, cityAreas]) => (
        <optgroup label={city} key={city}>
          {cityAreas.map((area) => (
            <option value={area.id} key={area.stableId}>{area.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );

  return (
    <>
      <form className="compare-form" onSubmit={submit}>
        <label>
          <span>Area A</span>
          <select value={left} onChange={(event) => setLeft(event.target.value)}>
            {options("Choose area…")}
          </select>
        </label>
        <div className="compare-vs">VS</div>
        <label>
          <span>Area B</span>
          <select value={right} onChange={(event) => setRight(event.target.value)}>
            {options("Choose area…")}
          </select>
        </label>
        <button type="submit" disabled={!left || !right || left === right || !sameCity}>Compare</button>
      </form>

      {left === right && left ? <div className="notice">Choose two different areas.</div> : null}
      {!sameCity ? (
        <div className="notice">
          Cross-city comparison is deliberately disabled: London and Madrid currently use different official source definitions.
        </div>
      ) : null}
      {loading ? <div className="notice">Loading official comparison…</div> : null}
      {failed ? <div className="notice">The comparison data could not be loaded.</div> : null}

      {!loading && profiles[0] && profiles[1] ? (
        <Comparison left={profiles[0]} right={profiles[1]} />
      ) : null}
    </>
  );
}

function Comparison({ left, right }: { left: CompareProfile; right: CompareProfile }) {
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

  return (
    <section className="compare-results">
      <div className="compare-head">
        <div>
          <span>AREA A · {left.cityName}</span>
          <h2>{left.name}</h2>
          <Link href={`/area/${encodeURIComponent(left.id)}`}>Open full profile →</Link>
        </div>
        <div>
          <span>AREA B · {right.cityName}</span>
          <h2>{right.name}</h2>
          <Link href={`/area/${encodeURIComponent(right.id)}`}>Open full profile →</Link>
        </div>
      </div>

      <div className="compare-metrics">
        <Metric label="Source incidents" left={left.total.toLocaleString("en-GB")} right={right.total.toLocaleString("en-GB")} />
        <Metric label="Area" left={`${left.areaKm2.toFixed(2)} km²`} right={`${right.areaKm2.toFixed(2)} km²`} />
        <Metric label="Incidents / km²" left={Math.round(left.incidentsPerKm2).toLocaleString("en-GB")} right={Math.round(right.incidentsPerKm2).toLocaleString("en-GB")} />
        <Metric label="Density percentile" left={`P${Math.round(left.densityPercentile * 100)}`} right={`P${Math.round(right.densityPercentile * 100)}`} />
      </div>

      <div className="compare-category-table">
        <div className="compare-row compare-row-head">
          <span>{left.name}</span><strong>Incident mix · {left.month}</strong><span>{right.name}</span>
        </div>
        {categories.map((slug) => (
          <div className="compare-row" key={slug}>
            <span>{valueFor(left, slug).toLocaleString("en-GB")}</span>
            <strong>{labelFor(slug)}</strong>
            <span>{valueFor(right, slug).toLocaleString("en-GB")}</span>
          </div>
        ))}
      </div>

      <p className="compare-note">
        Percentiles compare source incidents per km² across {left.cityName} {densityContext} for the same snapshot.
        This is descriptive local context, not a personal-risk score or a cross-city ranking.
      </p>
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
