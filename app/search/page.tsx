import { getNeighbourhoods } from "@/lib/data";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export const metadata = {
  title: "Search London neighbourhoods",
};

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();

  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let error = false;

  try {
    areas = await getNeighbourhoods();
  } catch {
    error = true;
  }

  const results = query
    ? areas
        .filter((area) => area.name.toLowerCase().includes(query))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name);
        })
        .slice(0, 60)
    : areas.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);

  return (
    <main className="search-page">
      <a className="back" href="/">← Home</a>
      <div className="eyebrow">London neighbourhood finder</div>
      <h1>{query ? <>Results for <em>“{q.trim()}”</em></> : "Browse London"}</h1>

      <form className="search-form search-form-page" action="/search" method="get">
        <label className="sr-only" htmlFor="search-again">Search a London neighbourhood</label>
        <input id="search-again" name="q" defaultValue={q} placeholder="Try Soho, Camden, Brixton…" autoFocus />
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
                <a href={`/area/${encodeURIComponent(area.id)}`} key={area.id}>
                  <span>London</span>
                  <strong>{area.name}</strong>
                  <i>Open profile →</i>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
