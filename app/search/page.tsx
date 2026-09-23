import { Suspense } from "react";
import Link from "next/link";
import { getNeighbourhoods } from "@/lib/data";
import SearchClient from "./SearchClient";

export const metadata = {
  title: "Search areas",
};

export const dynamic = "force-static";

export default async function SearchPage() {
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let error = false;

  try {
    areas = await getNeighbourhoods();
  } catch {
    error = true;
  }

  return (
    <main className="search-page">
      <Link className="back" href="/">← Home</Link>
      <Suspense fallback={<div className="notice">Loading neighbourhood finder…</div>}>
        <SearchClient areas={areas} error={error} />
      </Suspense>
    </main>
  );
}
