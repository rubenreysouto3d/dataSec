export type SavedPlace = {
  id: string;
  city: "madrid" | "london";
  name: string;
  purpose: "visitor" | "resident";
  areaId?: string;
  latitude?: number;
  longitude?: number;
};
const STORAGE_KEY = "datasec.saved.v2";
export function readSaved(): SavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((p): p is SavedPlace => Boolean(
      p && typeof p.id === "string" && typeof p.name === "string" &&
      (p.city === "madrid" || p.city === "london") &&
      (p.purpose === "visitor" || p.purpose === "resident"),
    )).slice(0, 100);
  } catch { return []; }
}
export function toggleSaved(item: SavedPlace): SavedPlace[] {
  const current = readSaved();
  const found = current.some(p => p.id === item.id && p.purpose === item.purpose);
  const next = found
    ? current.filter(p => !(p.id === item.id && p.purpose === item.purpose))
    : [item, ...current].slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("datasec:saved"));
  return next;
}
