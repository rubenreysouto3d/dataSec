import { areaIdFromPath } from "@/lib/area-route";
import { loadPlaceEvidence } from "@/lib/place-evidence-server";
import { placeEvidenceExplanation, placeEvidenceLabel, placeEvidenceSource } from "@/lib/place-evidence";
import { localeFromValue } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** One documented representation, consumed by future integrations. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const purpose = url.searchParams.get("view") === "visitor" ? "visitor" : "resident";
  const locale = localeFromValue(url.searchParams.get("lang"));
  try {
    const result = await loadPlaceEvidence(areaIdFromPath(id), purpose);
    if (!result) return Response.json({ error: "Unknown place" }, { status: 404 });
    const { area, evidence, hasCityHarmSeries } = result;
    return Response.json({
      version: 1,
      place: { id: area.id, name: area.name, city: area.citySlug,
        cityName: area.cityName, parentName: area.parentName },
      evidence,
      indicatorLabel: placeEvidenceLabel(area.citySlug, purpose, hasCityHarmSeries, locale),
      explanation: placeEvidenceExplanation(area.citySlug, purpose, hasCityHarmSeries, locale),
      source: placeEvidenceSource(area.citySlug, locale),
      limitation: locale === "es"
        ? "Los registros geográficos no predicen la seguridad individual. Las comparaciones solo se aplican dentro de esta ciudad y para el indicador indicado."
        : "Recorded geographic patterns do not predict individual safety. Comparisons apply only within this city and to the named indicator.",
    }, { headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex, nofollow",
    } });
  } catch (error) {
    console.error("place evidence request failed", error);
    return Response.json({ error: "Evidence temporarily unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
