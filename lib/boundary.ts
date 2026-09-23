export type Point = { latitude: string; longitude: string };

export function boundaryPath(
  input: Point[] | Point[][],
  width = 700,
  height = 360,
  padding = 24,
): string {
  const rings: Point[][] =
    input.length > 0 && Array.isArray(input[0])
      ? (input as Point[][])
      : [input as Point[]];

  const usable = rings.filter((ring) => ring.length >= 3);
  if (usable.length === 0) return "";

  const all = usable.flat().map((p) => ({
    x: Number(p.longitude),
    y: Number(p.latitude),
  }));
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
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

  return usable
    .map((ring) =>
      ring
        .map((p, index) => {
          const x = ox + (Number(p.longitude) - minX) * scale;
          const y = height - (oy + (Number(p.latitude) - minY) * scale);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ") + " Z",
    )
    .join(" ");
}
