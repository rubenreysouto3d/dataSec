"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CityAreaContext, Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";

const PAGE_SIZE = 48;

type SortMode = "name" | "density-desc" | "density-asc";

export default function CityAreaExplorer({
  areas,
  contexts,
}: {
  areas: Neighbourhood[];
  contexts: CityAreaContext[];
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const contextByArea = useMemo(
    () => new Map(contexts.map((context) => [context.areaId, context])),
    [contexts],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const result = normalized
      ? areas.filter((area) => area.name.toLocaleLowerCase().includes(normalized))
      : areas.slice();

    result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);

      const aDensity = contextByArea.get(a.id)?.incidentsPerKm2;
      const bDensity = contextByArea.get(b.id)?.incidentsPerKm2;
      if (aDensity === undefined && bDensity === undefined) return a.name.localeCompare(b.name);
      if (aDensity === undefined) return 1;
      if (bDensity === undefined) return -1;

      const densityOrder = sort === "density-desc" ? bDensity - aDensity : aDensity - bDensity;
      return densityOrder || a.name.localeCompare(b.name);
    });

    return result;
  }, [areas, contextByArea, query, sort]);

  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  return (
    <div className="city-area-explorer">
      <div className="city-area-tools">
        <label>
          <span>Find an area</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Type a neighbourhood name…"
            autoComplete="off"
          />
        </label>

        <label className="city-sort">
          <span>Order</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortMode);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="name">Name A–Z</option>
            <option value="density-desc">Recorded density · higher first</option>
            <option value="density-asc">Recorded density · lower first</option>
          </select>
        </label>

        <p>
          {filtered.length.toLocaleString("en-GB")} area{filtered.length === 1 ? "" : "s"}
          {query.trim() ? " matched" : " available"}
        </p>
      </div>

      {sort !== "name" ? (
        <p className="density-caution">
          This orders areas by recorded incidents per km² in the same source and snapshot. It is not a personal-risk or safety ranking.
        </p>
      ) : null}

      {visible.length ? (
        <>
          <div className="area-grid">
            {visible.map((area) => {
              const context = contextByArea.get(area.id);
              return (
                <Link className="area-card" href={areaHref(area.id)} key={area.stableId}>
                  <span className="area-city">{area.cityName}</span>
                  <h3>{area.name}</h3>
                  {context ? (
                    <small className="area-context">
                      <strong>
                        {context.densityPercentile < 0.2
                          ? "Among the lowest recorded levels"
                          : context.densityPercentile < 0.4
                            ? "Lower than most areas"
                            : context.densityPercentile < 0.6
                              ? "Around the city middle"
                              : context.densityPercentile < 0.8
                                ? "Higher than most areas"
                                : "Among the highest recorded levels"}
                      </strong>
                      <span>
                        {Math.round(context.incidentsPerKm2).toLocaleString("en-GB")}/km² · about {Math.round(context.densityPercentile * 100)}% of areas are lower
                      </span>
                    </small>
                  ) : (
                    <small className="area-context">Context unavailable</small>
                  )}
                  <span className="arrow">View profile →</span>
                </Link>
              );
            })}
          </div>

          {remaining > 0 ? (
            <button
              className="show-more"
              type="button"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, remaining)} more
              <small>{remaining.toLocaleString("en-GB")} still hidden</small>
            </button>
          ) : null}
        </>
      ) : (
        <div className="notice">No stored area matches that name.</div>
      )}
    </div>
  );
}
