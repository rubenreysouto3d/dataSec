import type { PlacePurpose } from "@/lib/place-evidence";

export type ReportPoint = {
  latitude: number;
  longitude: number;
  label: string;
  view: PlacePurpose;
};

export function validReportCoordinates(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function readReportPoint(query: {
  lat?: string; lng?: string; place?: string; view?: string;
}): ReportPoint | null {
  if (!query.lat || !query.lng) return null;
  const latitude = Number(query.lat);
  const longitude = Number(query.lng);
  if (!validReportCoordinates(latitude, longitude)) return null;
  return {
    latitude,
    longitude,
    // Untrusted public URLs must never generate arbitrarily large documents.
    label: query.place?.trim().slice(0, 170) || "Ubicación seleccionada",
    view: query.view === "resident" ? "resident" : "visitor",
  };
}

export function locationReportHref(point: ReportPoint) {
  const p = new URLSearchParams({
    lat: point.latitude.toFixed(6),
    lng: point.longitude.toFixed(6),
    place: point.label.slice(0, 170),
    view: point.view,
  });
  return "/v2/report?" + p.toString();
}
