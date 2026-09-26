import { Suspense } from "react";
import Link from "next/link";
import { getNeighbourhoods } from "@/lib/data";
import SearchClient from "./SearchClient";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";

export const metadata = {
  title: "Search areas",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let error = false;

  try {
    areas = await getNeighbourhoods();
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  return (
    <main className="search-page">
      <Link className="back" href={localeHref(locale, "/")}>
        ← {tr(locale, "Home", "Inicio")}
      </Link>
      <Suspense
        fallback={
          <div className="notice">
            {tr(locale, "Loading neighbourhood finder…", "Cargando buscador de zonas…")}
          </div>
        }
      >
        <SearchClient areas={areas} error={error} />
      </Suspense>
    </main>
  );
}
