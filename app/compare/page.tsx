import { Suspense } from "react";
import Link from "next/link";
import { getNeighbourhoods } from "@/lib/data";
import CompareClient from "./CompareClient";

export const metadata = {
  title: "Compare areas",
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
      <div className="eyebrow">Local comparison</div>
      <h1>Compare two areas.</h1>
      <p className="compare-intro">
        Compare like with like inside the same city and source. dataSec does not compare unlike official datasets as if they measured the same thing.
      </p>
      <Suspense fallback={<div className="notice">Loading comparison…</div>}>
        <CompareClient areas={areas} sourceError={error} />
      </Suspense>
    </main>
  );
}
