export function areaPathId(areaId: string): string {
  return areaId.replace(/:/g, "~");
}

export function areaIdFromPath(pathId: string): string {
  const decoded = decodeURIComponent(pathId);
  return decoded.includes("~") ? decoded.replace(/~/g, ":") : decoded;
}

export function areaHref(areaId: string): string {
  return `/area/${encodeURIComponent(areaPathId(areaId))}`;
}
