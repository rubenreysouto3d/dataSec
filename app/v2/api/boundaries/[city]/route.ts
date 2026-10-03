import { notFound } from "next/navigation";
import { getCityBoundaries, getNeighbourhoods } from "@/lib/data";

export const dynamic = "force-dynamic";

// Bounds are fetched only on an explicit map visit, not embedded in the
// answer-first dossier. This prevents large city polygons bloating initial HTML.
export async function GET(_request: Request, { params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  if (city !== "madrid" && city !== "london") notFound();
  try {
    const areas = await getNeighbourhoods(city);
    const boundaries = await getCityBoundaries(areas.map(a => a.id));
    return Response.json(boundaries, {
      headers: {
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=43200",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch(error) {
    console.error("City boundaries unavailable", error);
    return Response.json({ error: "Geographic layer temporarily unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
