"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Neighbourhood } from "@/lib/data";

const PAGE_SIZE = 48;

export default function CityAreaExplorer({ areas }: { areas: Neighbourhood[] }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const sorted = areas.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!normalized) return sorted;
    return sorted.filter((area) => area.name.toLocaleLowerCase().includes(normalized));
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

      {visible.length ? (
        <>
          <div className="area-grid">
            {visible.map((area) => (
              <Link className="area-card" href={`/area/${encodeURIComponent(area.id)}`} key={area.stableId}>
                <span className="area-city">{area.cityName}</span>
                <h3>{area.name}</h3>
                <span className="arrow">View profile →</span>
              </Link>
            ))}
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
