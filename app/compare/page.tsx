import { Suspense } from "react";
import Link from "next/link";
import { getNeighbourhoods } from "@/lib/data";
import CompareClient from "./CompareClient";

export const metadata = {
  title: "Compare London neighbourhoods",
};

export const dynamic = "force-static";

export default async function ComparePage() {
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let error = false;

  try {
    areas = await getNeighbourhoods();
  } catch {
    error = true;
  }

  return (
    <main className="compare-page">
      <Link className="back" href="/">← Home</Link>
      <div className="eyebrow">London comparison</div>
      <h1>Compare two neighbourhoods.</h1>
      <p className="compare-intro">
        Same city, same source, same month. The comparison is descriptive context — not a verdict on which place is “safe”.
      </p>
      <Suspense fallback={<div className="notice">Loading comparison…</div>}>
        <CompareClient areas={areas} sourceError={error} />
      </Suspense>
    </main>
  );
}
