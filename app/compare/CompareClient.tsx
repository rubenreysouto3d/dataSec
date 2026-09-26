"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  areaDisplayName,
  type CityMapMetric,
  type CitySafetySignal,
  type Neighbourhood,
} from "@/lib/data";
import {
  buildVisitorPercentileMap,
} from "@/lib/map-filters";
import {
  bandMode,
  bandNumber,
  isMapLayerKey,
  mapLayerLabel,
  metricForLayer,
  metricKeyForLayer,
  relativeBand,
  type MapLayerKey,
  type MapLayerMetric,
} from "@/lib/map-view";
import { getCompareProfile, type CompareProfile } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";
import {
  localizeCanonicalCategory,
  localeFromValue,
  localeHref,
  localeTag,
  tr,
  type Locale,
} from "@/lib/i18n";

type Props = {
  areas: Neighbourhood[];
  metrics: CityMapMetric[];
  safetySignals: CitySafetySignal[];
  sourceError: boolean;
};

const LAYER_OPTIONS: Array<{ value: MapLayerKey; label: string }> = [
  { value: "contextual-overview", label: "Resident context" },
  { value: "visitor-context", label: "Visitor context" },
  { value: "violence-property", label: "Violence + property · per km²" },
  { value: "violence-property-resident", label: "Violence + property · per 10,000 residents" },
  { value: "theft", label: "Theft + robbery · per km²" },
  { value: "theft-resident", label: "Theft + robbery · per 10,000 residents" },
  { value: "crime-related", label: "All crime-related · per km²" },
  { value: "crime-related-resident", label: "All crime-related · per 10,000 residents" },
  { value: "activity", label: "All source activity · per km²" },
];

function compareHref(a: string, b: string, layer: MapLayerKey, locale: Locale) {
  const params = new URLSearchParams();
  if (a) params.set("a", a);
  if (b) params.set("b", b);
  params.set("layer", layer);
  return localeHref(locale, `/compare?${params.toString()}`);
}

function percentileLabel(percentile: number | null, locale: Locale) {
  if (percentile === null || !Number.isFinite(percentile)) {
    return tr(locale, "Unavailable", "No disponible");
  }
  const value = Math.round(percentile * 100);
  return locale === "es" ? `percentil ${value}` : `${value}th percentile`;
}

function formatLayerValue(metric: MapLayerMetric, locale: Locale) {
  if (metric.value === null || !Number.isFinite(metric.value)) return "—";
  return `${metric.value.toLocaleString(localeTag(locale), { maximumFractionDigits: 1 })}${metric.unit}`;
}

export default function CompareClient({
  areas,
  metrics,
  safetySignals,
  sourceError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = localeFromValue(searchParams.get("lang"));
  const a = searchParams.get("a") ?? "";
  const b = searchParams.get("b") ?? "";
  const requestedLayer = searchParams.get("layer");
  const layer: MapLayerKey = isMapLayerKey(requestedLayer)
    ? requestedLayer
    : "contextual-overview";

  const [left, setLeft] = useState(a);
  const [right, setRight] = useState(b);
  const [profiles, setProfiles] = useState<[CompareProfile | null, CompareProfile | null]>([
    null,
    null,
  ]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const byId = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const metricById = useMemo(
    () => new Map(metrics.map((metric) => [metric.areaId, metric])),
    [metrics],
  );
  const safetyById = useMemo(
    () => new Map(safetySignals.map((signal) => [signal.areaId, signal])),
    [safetySignals],
  );
  const visitorById = useMemo(() => {
    const result = new Map<string, number>();
    for (const citySlug of ["london", "madrid"] as const) {
      const cityMetrics = metrics.filter((metric) => metric.citySlug === citySlug);
      for (const [areaId, percentile] of buildVisitorPercentileMap(cityMetrics)) {
        result.set(areaId, percentile);
      }
    }
    return result;
  }, [metrics]);

  const leftArea = byId.get(left);
  const rightArea = byId.get(right);
  const sameCity = !left || !right || leftArea?.citySlug === rightArea?.citySlug;

  const signalFor = (areaId: string) =>
    metricForLayer(
      metricById.get(areaId),
      layer,
      safetyById.get(areaId),
      visitorById.get(areaId),
    );

  const leftSignal = left ? signalFor(left) : null;
  const rightSignal = right ? signalFor(right) : null;

  useEffect(() => {
    setLeft(a);
    setRight(b);
    const leftArea = byId.get(a);
    const rightArea = byId.get(b);
    if (!a || !b || !leftArea || !rightArea || leftArea.citySlug !== rightArea.citySlug) {
      setProfiles([null, null]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    Promise.all([getCompareProfile(a), getCompareProfile(b)])
      .then((result) => {
        if (!cancelled) setProfiles(result as [CompareProfile | null, CompareProfile | null]);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [a, b, byId]);

  const grouped = useMemo(() => {
    const result = new Map<string, Neighbourhood[]>();
    for (const area of areas.slice().sort((x, y) => areaDisplayName(x).localeCompare(areaDisplayName(y)))) {
      const bucket = result.get(area.cityName) ?? [];
      bucket.push(area);
      result.set(area.cityName, bucket);
    }
    return result;
  }, [areas]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!left || !right || left === right || !sameCity) return;
    router.push(compareHref(left, right, layer, locale));
  }

  function changeLayer(nextLayer: MapLayerKey) {
    router.push(compareHref(left, right, nextLayer, locale));
  }

  if (sourceError) {
    return (
      <div className="notice">
        {tr(
          locale,
          "The stored area list could not be loaded.",
          "No se pudo cargar la lista de zonas almacenada.",
        )}
      </div>
    );
  }

  const options = (placeholder: string, citySlug?: string, excludedId?: string) => (
    <>
      <option value="">{placeholder}</option>
      {[...grouped.entries()].map(([city, cityAreas]) => {
        const filteredAreas = cityAreas.filter(
          (area) => (!citySlug || area.citySlug === citySlug) && area.id !== excludedId,
        );
        if (!filteredAreas.length) return null;
        return (
          <optgroup label={city} key={city}>
            {filteredAreas.map((area) => (
              <option value={area.id} key={area.stableId}>{areaDisplayName(area)}</option>
            ))}
          </optgroup>
        );
      })}
    </>
  );

  function changeLeft(value: string) {
    setLeft(value);
    const nextLeft = byId.get(value);
    const currentRight = byId.get(right);
    if (nextLeft && currentRight && nextLeft.citySlug !== currentRight.citySlug) {
      setRight("");
    }
  }

  function swapAreas() {
    setLeft(right);
    setRight(left);
    if (left && right) {
      router.push(compareHref(right, left, layer, locale));
    }
  }

  return (
    <>
      <div className="compare-view-control">
        <label>
          <span>{tr(locale, "Compare using", "Comparar usando")}</span>
          <select
            value={layer}
            onChange={(event) => changeLayer(event.target.value as MapLayerKey)}
          >
            {LAYER_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {mapLayerLabel(option.value, locale)}
              </option>
            ))}
          </select>
        </label>
        <small>
          {tr(
            locale,
            "Uses the same city-local signal as the map. Changing this control never creates a cross-city score.",
            "Usa la misma señal local de la ciudad que el mapa. Cambiar este control nunca crea una puntuación entre ciudades.",
          )}
        </small>
      </div>

      <form className="compare-form" onSubmit={submit}>
        <label>
          <span>{tr(locale, "Area A", "Zona A")}</span>
          <select value={left} onChange={(event) => changeLeft(event.target.value)}>
            {options(tr(locale, "Choose area…", "Elige una zona…"), undefined, right)}
          </select>
        </label>
        <button
          className="compare-swap"
          type="button"
          onClick={swapAreas}
          disabled={!left || !right}
          aria-label={tr(locale, "Swap compared areas", "Intercambiar zonas comparadas")}
          title={tr(locale, "Swap areas", "Intercambiar zonas")}
        >
          ⇄
        </button>
        <label>
          <span>{tr(locale, "Area B", "Zona B")}</span>
          <select value={right} onChange={(event) => setRight(event.target.value)}>
            {options(
              leftArea
                ? locale === "es"
                  ? `Elige otra zona de ${leftArea.cityName}…`
                  : `Choose another ${leftArea.cityName} area…`
                : tr(locale, "Choose area…", "Elige una zona…"),
              leftArea?.citySlug,
              left,
            )}
          </select>
        </label>
        <button type="submit" disabled={!left || !right || left === right || !sameCity}>{tr(locale, "Compare", "Comparar")}</button>
      </form>

      {left === right && left ? (
        <div className="notice">
          {tr(locale, "Choose two different areas.", "Elige dos zonas diferentes.")}
        </div>
      ) : null}
      {!left ? (
        <div className="compare-start-hint">
          {tr(locale, "Choose Area A first.", "Elige primero la Zona A.")}
        </div>
      ) : null}
      {loading ? (
        <div className="notice">
          {tr(locale, "Loading official comparison…", "Cargando comparación oficial…")}
        </div>
      ) : null}
      {failed ? (
        <div className="notice">
          {tr(locale, "The comparison data could not be loaded.", "No se pudieron cargar los datos de comparación.")}
        </div>
      ) : null}

      {!loading &&
      profiles[0] &&
      profiles[1] &&
      leftSignal &&
      rightSignal &&
      leftArea &&
      rightArea ? (
        <Comparison
          left={profiles[0]}
          right={profiles[1]}
          leftSignal={leftSignal}
          rightSignal={rightSignal}
          leftLabel={areaDisplayName(leftArea)}
          rightLabel={areaDisplayName(rightArea)}
          layer={layer}
          locale={locale}
        />
      ) : null}
    </>
  );
}

function Comparison({
  left,
  right,
  leftSignal,
  rightSignal,
  leftLabel,
  rightLabel,
  layer,
  locale,
}: {
  left: CompareProfile;
  right: CompareProfile;
  leftSignal: MapLayerMetric;
  rightSignal: MapLayerMetric;
  leftLabel: string;
  rightLabel: string;
  layer: MapLayerKey;
  locale: Locale;
}) {
  const categorySlugs = (group: "safety" | "other", limit: number) =>
    Array.from(new Set([
      ...left.categories.filter((item) => item.group === group).slice(0, limit).map((item) => item.slug),
      ...right.categories.filter((item) => item.group === group).slice(0, limit).map((item) => item.slug),
    ]));

  const safetyCategories = categorySlugs("safety", 7);
  const otherCategories = categorySlugs("other", 5);

  const labelFor = (slug: string) =>
    left.categories.find((item) => item.slug === slug)?.label ??
    right.categories.find((item) => item.slug === slug)?.label ??
    slug;

  const valueFor = (profile: CompareProfile, slug: string) =>
    profile.categories.find((item) => item.slug === slug)?.count ?? 0;

  const mode = bandMode(metricKeyForLayer(layer));
  const leftPercentile = leftSignal.percentile;
  const rightPercentile = rightSignal.percentile;
  const leftPct = leftPercentile === null ? null : Math.round(leftPercentile * 100);
  const rightPct = rightPercentile === null ? null : Math.round(rightPercentile * 100);
  const sameRelativePosition =
    leftPercentile !== null &&
    rightPercentile !== null &&
    Math.abs(leftPercentile - rightPercentile) < 0.01;
  const higherLabel =
    leftPercentile === null || rightPercentile === null || sameRelativePosition
      ? null
      : leftPercentile > rightPercentile
        ? leftLabel
        : rightLabel;

  return (
    <section className="compare-results">
      <div className="compare-head">
        <div>
          <span>{tr(locale, "AREA A", "ZONA A")} · {left.cityName}</span>
          <h2>{leftLabel}</h2>
          <Link href={localeHref(locale, areaHref(left.id))}>
            {tr(locale, "Open full profile →", "Abrir ficha completa →")}
          </Link>
        </div>
        <div>
          <span>{tr(locale, "AREA B", "ZONA B")} · {right.cityName}</span>
          <h2>{rightLabel}</h2>
          <Link href={localeHref(locale, areaHref(right.id))}>
            {tr(locale, "Open full profile →", "Abrir ficha completa →")}
          </Link>
        </div>
      </div>

      <div className="compare-takeaway compare-takeaway-clean">
        <span>{mapLayerLabel(layer, locale).toUpperCase()}</span>
        <div>
          <strong>
            {higherLabel
              ? locale === "es"
                ? `${higherLabel} tiene la señal relativa más alta en esta vista`
                : `${higherLabel} has the higher relative signal on this view`
              : sameRelativePosition
                ? tr(
                    locale,
                    "Both areas are at almost the same relative position",
                    "Ambas zonas están prácticamente en la misma posición relativa",
                  )
                : tr(
                    locale,
                    "A relative comparison is unavailable for one of these areas",
                    "La comparación relativa no está disponible para una de estas zonas",
                  )}
          </strong>
          <p>
            {locale === "es"
              ? `Compara la misma señal «${mapLayerLabel(layer, locale).toLowerCase()}» que usa el mapa de ${left.cityName}.`
              : `This compares the same ${mapLayerLabel(layer, locale).toLowerCase()} signal used on the ${left.cityName} map.`}
          </p>
        </div>
      </div>

      <div className="compare-metrics">
        <Metric
          label={tr(locale, "Local level", "Nivel local")}
          left={bandNumber(leftPercentile) ? `${tr(locale, "Level", "Nivel")} ${bandNumber(leftPercentile)}/5` : "—"}
          right={bandNumber(rightPercentile) ? `${tr(locale, "Level", "Nivel")} ${bandNumber(rightPercentile)}/5` : "—"}
        />
        <Metric
          label={tr(locale, "City position", "Posición en la ciudad")}
          left={percentileLabel(leftPercentile, locale)}
          right={percentileLabel(rightPercentile, locale)}
        />
        {(leftSignal.value !== null || rightSignal.value !== null) ? (
          <Metric
            label={tr(locale, "Recorded value", "Valor registrado")}
            left={formatLayerValue(leftSignal, locale)}
            right={formatLayerValue(rightSignal, locale)}
          />
        ) : null}
      </div>

      <div className="compare-position">
        <article>
          <span>{leftLabel}</span>
          <strong>{relativeBand(leftPercentile, mode, locale)}</strong>
          <p>{leftPct === null
            ? tr(locale, "No local percentile", "Sin percentil local")
            : locale === "es"
              ? `percentil ${leftPct} dentro de ${left.cityName}`
              : `${leftPct}th percentile within ${left.cityName}`}</p>
          <div className="compare-position-track">
            <i style={{ width: `${leftPct ?? 0}%` }} />
          </div>
        </article>
        <article>
          <span>{rightLabel}</span>
          <strong>{relativeBand(rightPercentile, mode, locale)}</strong>
          <p>{rightPct === null
            ? tr(locale, "No local percentile", "Sin percentil local")
            : locale === "es"
              ? `percentil ${rightPct} dentro de ${right.cityName}`
              : `${rightPct}th percentile within ${right.cityName}`}</p>
          <div className="compare-position-track">
            <i style={{ width: `${rightPct ?? 0}%` }} />
          </div>
        </article>
      </div>

      <details className="compare-details">
        <summary>
          <span>{tr(locale, "Detailed recorded mix", "Detalle de actividad registrada")}</span>
          <small>
            {tr(
              locale,
              "Canonical categories, separate from the selected comparison signal",
              "Categorías canónicas, separadas de la señal de comparación seleccionada",
            )}
          </small>
        </summary>

        <div className="compare-category-table">
          <div className="compare-row compare-row-head">
            <span>{leftLabel}</span><strong>{tr(locale, "Safety-related", "Relacionado con seguridad")} · {left.month}</strong><span>{rightLabel}</span>
          </div>
          {safetyCategories.length ? safetyCategories.map((slug) => (
            <div className="compare-row" key={slug}>
              <span>{valueFor(left, slug).toLocaleString(localeTag(locale))}</span>
              <strong>{localizeCanonicalCategory(locale, labelFor(slug))}</strong>
              <span>{valueFor(right, slug).toLocaleString(localeTag(locale))}</span>
            </div>
          )) : (
            <div className="notice">
              {tr(
                locale,
                "No mapped safety categories are available for this snapshot.",
                "No hay categorías de seguridad mapeadas disponibles para esta captura.",
              )}
            </div>
          )}
        </div>

        {otherCategories.length ? (
          <div className="compare-category-table compare-category-table-other">
            <div className="compare-row compare-row-head">
              <span>{leftLabel}</span><strong>{tr(locale, "Other recorded activity", "Otra actividad registrada")}</strong><span>{rightLabel}</span>
            </div>
            {otherCategories.map((slug) => (
              <div className="compare-row" key={slug}>
                <span>{valueFor(left, slug).toLocaleString(localeTag(locale))}</span>
                <strong>{localizeCanonicalCategory(locale, labelFor(slug))}</strong>
                <span>{valueFor(right, slug).toLocaleString(localeTag(locale))}</span>
              </div>
            ))}
          </div>
        ) : null}
      </details>

      <details className="compare-note compare-note-details">
        <summary>{tr(locale, "How to read this comparison", "Cómo leer esta comparación")}</summary>
        <p>
          {locale === "es"
            ? `La comparación principal usa la misma definición «${mapLayerLabel(layer, locale).toLowerCase()}» que el mapa de la ciudad. Los percentiles y niveles son locales de ${left.cityName}; no son una puntuación europea de seguridad ni predicen el riesgo personal.`
            : `The primary comparison above uses the same ${mapLayerLabel(layer, locale).toLowerCase()} definition as the city map. Percentiles and levels are local to ${left.cityName}; they are not a Europe-wide safety score and do not predict personal risk.`}
        </p>
      </details>
    </section>
  );
}

function Metric({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className="compare-metric">
      <strong>{left}</strong>
      <span>{label}</span>
      <strong>{right}</strong>
    </div>
  );
}
