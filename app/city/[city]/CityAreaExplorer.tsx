"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";

const PAGE_SIZE = 48;

export default function CityAreaExplorer({
  areas,
}: {
  areas: Neighbourhood[];
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const area of areas) {
      const key = area.name.trim().toLocaleLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [areas]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const result = normalized
      ? areas.filter((area) => area.name.toLocaleLowerCase().includes(normalized))
      : areas.slice();

    result.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName) return byName;
      return a.sourceAreaId.localeCompare(b.sourceAreaId);
    });

    return result;
  }, [areas, query]);

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

        <p>
          {filtered.length.toLocaleString("en-GB")} area{filtered.length === 1 ? "" : "s"}
          {query.trim() ? " matched" : " available"}
        </p>
      </div>

      <p className="density-caution">
        Directory only. Relative levels are shown on the map above, where the active Resident, Visitor or filter view defines the comparison.
      </p>

      {visible.length ? (
        <>
          <div className="area-grid">
            {visible.map((area) => {
              const duplicate = (duplicateNames.get(area.name.trim().toLocaleLowerCase()) ?? 0) > 1;
              return (
                <Link className="area-card" href={areaHref(area.id)} key={area.stableId}>
                  <span className="area-city">
                    {area.cityName}
                    {duplicate ? ` · official area ${area.sourceAreaId}` : ""}
                  </span>
                  <h3>{area.name}</h3>
                  <small className="area-context">
                    Open the profile for local Resident and Visitor context.
                  </small>
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
