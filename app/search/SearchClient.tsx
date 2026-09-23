"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Neighbourhood } from "@/lib/data";

type Props = {
  areas: Neighbourhood[];
  error: boolean;
};

export default function SearchClient({ areas, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [value, setValue] = useState(q);

  useEffect(() => setValue(q), [q]);

  const query = q.trim().toLowerCase();
  const results = useMemo(
    () =>
      query
        ? areas
            .filter((area) => area.name.toLowerCase().includes(query))
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

  return (
    <>
      <div className="eyebrow">London neighbourhood finder</div>
      <h1>{query ? <>Results for <em>“{q.trim()}”</em></> : "Browse London"}</h1>

      <form className="search-form search-form-page" onSubmit={submit}>
        <label className="sr-only" htmlFor="search-again">Search a London neighbourhood</label>
        <input
          id="search-again"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Try Soho, Camden, Brixton…"
          autoFocus
        />
        <button type="submit">Search</button>
      </form>

      {error ? (
        <div className="notice">The stored dataset could not be reached, so no fallback results are being fabricated.</div>
      ) : (
        <>
          <p className="result-count">
            {query ? `${results.length} matching police neighbourhood${results.length === 1 ? "" : "s"}` : `Showing ${results.length} neighbourhoods`}
          </p>
          {results.length === 0 ? (
            <div className="notice">No Metropolitan Police neighbourhood matched that name. Try a broader spelling or nearby district.</div>
          ) : (
            <div className="search-results">
              {results.map((area) => (
                <Link href={`/area/${encodeURIComponent(area.id)}`} key={area.id}>
                  <span>London</span>
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
