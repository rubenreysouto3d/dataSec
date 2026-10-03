import {
  getAreaProfile, getCityMapMetrics, getCitySafetySignals, getNeighbourhoods,
} from "@/lib/data";
import { createPlaceEvidenceContext, type PlacePurpose } from "@/lib/place-evidence";

/** Shared server loader for the API and embedded widget. */
export async function loadPlaceEvidence(areaId: string, purpose: PlacePurpose) {
  const area = await getAreaProfile(areaId);
  if (!area) return null;
  const neighbours = await getNeighbourhoods(area.citySlug);
  const ids = neighbours.map((item) => item.id);
  const metrics = await getCityMapMetrics(area.citySlug, ids);
  const signals = await getCitySafetySignals(area.citySlug, ids, metrics);
  const context = createPlaceEvidenceContext(area.citySlug, metrics, signals);
  return {
    area,
    evidence: context.read(area.id, purpose),
    hasCityHarmSeries: context.hasCityHarmSeries,
  };
}
