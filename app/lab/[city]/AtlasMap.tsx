"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CityBoundary, Neighbourhood } from "@/lib/data";
import { MAP_COLOR_BANDS } from "@/lib/map-filters";
import { tr, type Locale } from "@/lib/i18n";

type Props = {
  city: "madrid" | "london";
  boundaries: CityBoundary[];
  areas: Neighbourhood[];
  values: Map<string, number | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  locale: Locale;
};
type Bounds = [[number, number], [number, number]];

const MAP_MODULE = "https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs";
const MAP_CSS = "https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.css";
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

function getBounds(items: CityBoundary[]): Bounds | null {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const boundary of items) {
    for (const ring of boundary.rings) for (const point of ring) {
      const lng = Number(point.longitude), lat = Number(point.latitude);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      west = Math.min(west, lng); south = Math.min(south, lat);
      east = Math.max(east, lng); north = Math.max(north, lat);
    }
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null;
}

export default function AtlasMap({
  city, boundaries, areas, values, selectedId, onSelect, locale,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  onSelectRef.current = onSelect;

  const areaById = useMemo(() => new Map(areas.map((item) => [item.id, item])), [areas]);
  const boundsById = useMemo(
    () => new Map(boundaries.map((item) => [item.areaId, getBounds([item])])),
    [boundaries],
  );
  const wholeCityBounds = useMemo(() => getBounds(boundaries), [boundaries]);

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: boundaries.flatMap((item) => {
      const area = areaById.get(item.areaId);
      if (!area || !item.rings.length) return [];
      const score = values.get(area.id);
      const level = score === null || score === undefined || !Number.isFinite(score)
        ? -1 : Math.min(5, Math.max(1, Math.floor(score * 5) + 1));
      const coordinates = item.rings.map((ring) =>
        ring.map((point) => [Number(point.longitude), Number(point.latitude)]),
      );
      return [{
        type: "Feature" as const,
        properties: { id: area.id, name: area.name, level },
        geometry: item.rings.length === 1
          ? { type: "Polygon" as const, coordinates: [coordinates[0]] }
          : { type: "MultiPolygon" as const, coordinates: coordinates.map((ring) => [ring]) },
      }];
    }),
  }), [boundaries, areaById, values]);
  const latestGeojson = useRef(geojson);
  latestGeojson.current = geojson;

  useEffect(() => {
    let cancelled = false;
    let map: any = null;
    async function initialise() {
      if (!container.current || !wholeCityBounds) return;
      setFailed(false);
      try {
        if (!document.querySelector("link[data-atlas-maplibre]")) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = MAP_CSS;
          link.dataset.atlasMaplibre = "true";
          document.head.appendChild(link);
        }
        const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<any>;
        const lib = await dynamicImport(MAP_MODULE);
        if (cancelled || !container.current) return;
        map = new lib.Map({
          container: container.current,
          style: MAP_STYLE,
          center: city === "madrid" ? [-3.7038, 40.4168] : [-0.1276, 51.5072],
          zoom: city === "madrid" ? 9.5 : 8.7,
          cooperativeGestures: false,
          attributionControl: true,
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ visualizePitch: false }), "bottom-right");
        map.on("load", () => {
          if (cancelled) return;
          map.addSource("atlas-areas", { type: "geojson", data: latestGeojson.current, promoteId: "id" });
          const firstLabel = map.getStyle().layers?.find((item: any) => item.type === "symbol")?.id;
          map.addLayer({
            id: "atlas-fill", type: "fill", source: "atlas-areas",
            paint: {
              "fill-color": ["match", ["get", "level"],
                1, MAP_COLOR_BANDS[0].color, 2, MAP_COLOR_BANDS[1].color,
                3, MAP_COLOR_BANDS[2].color, 4, MAP_COLOR_BANDS[3].color,
                5, MAP_COLOR_BANDS[4].color, "#b8c1c2"],
              "fill-opacity": 0.74,
            },
          }, firstLabel);
          map.addLayer({
            id: "atlas-edges", type: "line", source: "atlas-areas",
            paint: { "line-color": "rgba(255,255,255,.88)", "line-width": 1.05 },
          }, firstLabel);
          map.addLayer({
            id: "atlas-focus", type: "line", source: "atlas-areas",
            filter: ["==", ["get", "id"], ""],
            paint: { "line-color": "#172b31", "line-width": 3.7 },
          }, firstLabel);
          map.on("click", "atlas-fill", (event: any) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") onSelectRef.current(id);
          });
          const hoverPopup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 13, className: "fx-map-hover" });
          map.on("mouseenter", "atlas-fill", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mousemove", "atlas-fill", (event: any) => {
            const name = event.features?.[0]?.properties?.name;
            if (typeof name === "string") hoverPopup.setLngLat(event.lngLat).setText(name).addTo(map);
          });
          map.on("mouseleave", "atlas-fill", () => {
            map.getCanvas().style.cursor = "";
            hoverPopup.remove();
          });
          map.fitBounds(wholeCityBounds, { padding: 32, duration: 0, maxZoom: city === "madrid" ? 12 : 11 });
          setReady(true);
        });
        map.on("error", () => { /* Tile errors must not erase the accessible place list. */ });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    initialise();
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [city, wholeCityBounds]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current?.getSource?.("atlas-areas")?.setData?.(geojson);
  }, [geojson, ready]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map?.getLayer?.("atlas-focus")) return;
    map.setFilter("atlas-focus", ["==", ["get", "id"], selectedId ?? ""]);
    const selectedBounds = selectedId ? boundsById.get(selectedId) : null;
    if (selectedBounds) map.fitBounds(selectedBounds, { padding: 75, duration: 430, maxZoom: 13 });
  }, [selectedId, boundsById, ready]);

  return (
    <div className="atlas-geography">
      <div className="atlas-map-head">
        <span>{tr(locale, "02 / GEOGRAPHY", "02 / TERRITORIO")}</span>
        <button type="button" onClick={() => {
          if (mapRef.current && wholeCityBounds) mapRef.current.fitBounds(wholeCityBounds, { padding: 30, duration: 420, maxZoom: 11 });
        }}>{tr(locale, "Reset view ↗", "Toda la ciudad ↗")}</button>
      </div>
      <div ref={container} className="atlas-map-canvas" role="region"
        aria-label={tr(locale, "Interactive city map. The place list provides an accessible alternative.", "Mapa interactivo. La lista de lugares ofrece una alternativa accesible.")} />
      {!ready ? (
        <div className="atlas-map-loading" role="status">
          {failed
            ? tr(locale, "The basemap is unavailable. Select an area from the place list.", "El mapa base no está disponible. Elige una zona de la lista.")
            : tr(locale, "Loading geographic context…", "Cargando contexto geográfico…")}
        </div>
      ) : null}
      <div className="atlas-map-footer">
        <span>{tr(locale, "Colour: selected recorded indicator only", "Color: únicamente el indicador registrado elegido")}</span>
        <div aria-hidden="true">{MAP_COLOR_BANDS.map((band) => <i key={band.max} style={{ background: band.color }} />)}</div>
        <small>{tr(locale, "No data", "Sin dato")} ≠ 1</small>
      </div>
    </div>
  );
}
