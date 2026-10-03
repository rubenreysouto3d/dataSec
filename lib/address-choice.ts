import { readReportPoint, type ReportPoint } from "@/lib/location-report";
import type { AreaProfile } from "@/lib/data";
import type { PlaceEvidence } from "@/lib/place-evidence";

export type ChoicePoint = ReportPoint;
export type ChoiceSite = {
  point: ChoicePoint;
  area: AreaProfile;
  evidence: PlaceEvidence;
  indicator: string;
  explanation: string;
  source: { label: string; url: string; note: string };
};
export type ChoiceComparison = "same-area" | "comparable" | "different-period" | "different-city" | "unavailable";

export function choiceHref(first: ChoicePoint | null, second: ChoicePoint | null, view: "visitor" | "resident") {
  const params = new URLSearchParams({ view });
  for (const [prefix, item] of [["a",first],["b",second]] as const) {
    if (!item) continue;
    params.set(prefix+"lat",item.latitude.toFixed(6));
    params.set(prefix+"lng",item.longitude.toFixed(6));
    params.set(prefix+"place",item.label.slice(0,170));
  }
  return "/v2/choose?" + params;
}

export function readChoicePoint(query: Record<string,string|undefined>, prefix: "a"|"b",view:"visitor"|"resident") {
  return readReportPoint({
    lat:query[prefix+"lat"], lng:query[prefix+"lng"],
    place:query[prefix+"place"],view,
  });
}

export function comparisonKind(first:ChoiceSite, second:ChoiceSite):ChoiceComparison {
  if(first.area.citySlug!==second.area.citySlug) return "different-city";
  if(first.area.id===second.area.id) return "same-area";
  if(!first.evidence.available || !second.evidence.available ||
    first.evidence.value===null || second.evidence.value===null ||
    first.evidence.indicator!==second.evidence.indicator) return "unavailable";
  if(first.evidence.period!==second.evidence.period || !first.evidence.period ||
    !second.evidence.period) return "different-period";
  return "comparable";
}

export function sameExactPoint(a:ChoicePoint,b:ChoicePoint):boolean {
  return Math.abs(a.latitude-b.latitude)<0.00005 &&
    Math.abs(a.longitude-b.longitude)<0.00005;
}
