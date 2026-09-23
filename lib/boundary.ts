import type { Point } from "./police";

export function boundaryPath(points: Point[], width = 700, height = 360, padding = 24): string {
  if (points.length < 3) return "";
  const coords = points.map((p) => ({ x: Number(p.longitude), y: Number(p.latitude) }));
  const xs = coords.map((p) => p.x);
  const ys = coords.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 0.000001);
  const rangeY = Math.max(maxY - minY, 0.000001);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = Math.min(innerW / rangeX, innerH / rangeY);
  const usedW = rangeX * scale;
  const usedH = rangeY * scale;
  const ox = (width - usedW) / 2;
  const oy = (height - usedH) / 2;
  return coords
    .map((p, index) => {
      const x = ox + (p.x - minX) * scale;
      const y = height - (oy + (p.y - minY) * scale);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}
