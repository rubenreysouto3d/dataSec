"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Neighbourhood } from "@/lib/data";
import LocateButton from "@/components/LocateButton";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";

type Props = {
  areas: Neighbourhood[];
  error: boolean;
};

export default function SearchClient({ areas, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [value, setValue] = useState(q);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");

  useEffect(() => setValue(q), [q]);

  const query = q.trim().toLowerCase();
  const results = useMemo(
    () =>
      query
        ? areas
            .filter(
              (area) =>
                area.name.toLowerCase().includes(query) ||
                area.parentName?.toLowerCase().includes(query),
            )
            .sort((a, b) => {
              const aStarts = areaStarts(a.name, query);
              const bStarts = areaStarts(b.name, query);
              return aStarts - bStarts || a.name.localeCompare(b.name);
            })
            .slice(0, 60)
        : areas.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60),
    [areas, query],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  }

  async function findPlace() {
    const text = q.trim();
    if (!text || placeLoading) return;

    setPlaceLoading(true);
    setPlaceError("");
    try {
      const area = await resolvePlaceToArea(text);
      if (!area) {
        setPlaceError("That place could not be matched to current London or Madrid coverage.");
        return;
      }
      router.push(areaHref(area.id));
    } catch {
      setPlaceError("Place lookup is temporarily unavailable.");
    } finally {
      setPlaceLoading(false);
    }
  }

  return (
    <>
      <div className="eyebrow">London + Madrid area finder</div>
      <h1>{query ? <>Results for <em>“{q.trim()}”</em></> : "Browse areas"}</h1>

      <form className="search-form search-form-page" onSubmit={submit}>
        <label className="sr-only" htmlFor="search-again">Search an area</label>
        <input
          id="search-again"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Try Camden, Brixton, Sol, Lavapiés…"
          autoFocus
        />
        <button type="submit">Search</button>
      </form>
      <LocateButton />
      {query ? (
        <div className="place-lookup">
          <button type="button" onClick={findPlace} disabled={placeLoading}>
            {placeLoading ? "Matching place…" : "Find this place or address"}
          </button>
          <span>
            Uses OpenStreetMap Nominatim only when you click this button, then matches the result to dataSec&apos;s stored official boundary.
            {" "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
          </span>
          {placeError ? <small>{placeError}</small> : null}
        </div>
      ) : null}

      {error ? (
        <div className="notice">The stored dataset could not be reached, so no fallback results are being fabricated.</div>
      ) : (
        <>
          <p className="result-count">
            {query ? `${results.length} matching area${results.length === 1 ? "" : "s"}` : `Showing ${results.length} areas`}
          </p>
          {results.length === 0 ? (
            <div className="notice">No stored area matched that name. Try a broader spelling or nearby district/neighbourhood.</div>
          ) : (
            <div className="search-results">
              {results.map((area) => (
                <Link href={areaHref(area.id)} key={area.id}>
                  <span>{area.cityName}{area.parentName ? ` · ${area.parentName}` : ""}</span>
                  <strong>{area.name}</strong>
                  <i>Open profile →</i>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function areaStarts(name: string, query: string) {
  return name.toLowerCase().startsWith(query) ? 0 : 1;
}
