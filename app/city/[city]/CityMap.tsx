import { areaHref } from "@/lib/area-route";
import type { CityAreaContext, CityBoundary, Neighbourhood } from "@/lib/data";

type Props = {
  areas: Neighbourhood[];
  boundaries: CityBoundary[];
  contexts: CityAreaContext[];
};

type XY = { x: number; y: number };

export default function CityMap({ areas, boundaries, contexts }: Props) {
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const contextById = new Map(contexts.map((context) => [context.areaId, context]));
  const usable = boundaries.filter((boundary) => boundary.rings.some((ring) => ring.length >= 3));

  if (!usable.length) {
    return <div className="notice">Map geometry is temporarily unavailable.</div>;
  }

  const allPoints = usable.flatMap((boundary) => boundary.rings.flat()).map((point) => ({
    x: Number(point.longitude),
    y: Number(point.latitude),
  }));
  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = 1000;
  const height = 720;
  const padding = 24;
  const rangeX = Math.max(maxX - minX, 0.000001);
  const rangeY = Math.max(maxY - minY, 0.000001);
  const scale = Math.min(
    (width - padding * 2) / rangeX,
    (height - padding * 2) / rangeY,
  );
  const usedW = rangeX * scale;
  const usedH = rangeY * scale;
  const offsetX = (width - usedW) / 2;
  const offsetY = (height - usedH) / 2;

  function project(x: number, y: number): XY {
    return {
      x: offsetX + (x - minX) * scale,
      y: height - (offsetY + (y - minY) * scale),
    };
  }

  function ringPath(ring: CityBoundary["rings"][number]) {
    const stride = Math.max(1, Math.ceil(ring.length / 220));
    const sampled = ring.filter((_, index) => index % stride === 0 || index === ring.length - 1);
    return sampled
      .map((point, index) => {
        const p = project(Number(point.longitude), Number(point.latitude));
        return `${index === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z";
  }

  function percentileClass(value: number | undefined) {
    if (value === undefined) return "map-bin-none";
    if (value < 0.2) return "map-bin-1";
    if (value < 0.4) return "map-bin-2";
    if (value < 0.6) return "map-bin-3";
    if (value < 0.8) return "map-bin-4";
    return "map-bin-5";
  }

  return (
    <section className="city-map-panel">
      <div className="panel-head">
        <div>
          <span>MAP</span>
          <h2>Latest source-density context</h2>
        </div>
        <small>Click an area for its profile</small>
      </div>

      <svg
        className="city-map"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Neighbourhood source-density map"
      >
        {usable.map((boundary) => {
          const area = areaById.get(boundary.areaId);
          if (!area) return null;
          const context = contextById.get(boundary.areaId);
          const d = boundary.rings.map(ringPath).join(" ");
          return (
            <a href={areaHref(area.id)} key={area.id}>
              <path
                d={d}
                className={percentileClass(context?.densityPercentile)}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {area.name}
                  {context
                    ? ` · P${Math.round(context.densityPercentile * 100)} · ${Math.round(context.incidentsPerKm2).toLocaleString("en-GB")}/km²`
                    : " · no context"}
                </title>
              </path>
            </a>
          );
        })}
      </svg>

      <div className="map-legend" aria-label="Map legend">
        <span>Lower source density</span>
        <i className="map-bin-1" />
        <i className="map-bin-2" />
        <i className="map-bin-3" />
        <i className="map-bin-4" />
        <i className="map-bin-5" />
        <span>Higher source density</span>
      </div>
      <p className="density-caution">
        Colours are percentiles within this city and this source snapshot. They describe recorded incident concentration per km², not personal risk.
      </p>
    </section>
  );
}
