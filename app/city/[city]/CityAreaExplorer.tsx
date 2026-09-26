"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Neighbourhood } from "@/lib/data";
import { areaHref } from "@/lib/area-route";
import { localeHref, localeTag, tr, type Locale } from "@/lib/i18n";

const PAGE_SIZE = 48;

export default function CityAreaExplorer({
  areas,
  locale = "en",
}: {
  areas: Neighbourhood[];
  locale?: Locale;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const area of areas) {
      const key = area.name.trim().toLocaleLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [areas]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const result = normalized
      ? areas.filter(
          (area) =>
            area.name.toLocaleLowerCase().includes(normalized) ||
            area.parentName?.toLocaleLowerCase().includes(normalized),
        )
      : areas.slice();

    result.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName) return byName;
      return a.sourceAreaId.localeCompare(b.sourceAreaId);
    });

    return result;
  }, [areas, query]);

  const visible = filtered.slice(0, limit);
  const remaining = filtered.length - visible.length;

  return (
    <div className="city-area-explorer">
      <div className="city-area-tools">
        <label>
          <span>{tr(locale, "Find an area", "Buscar una zona")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder={tr(locale, "Type a neighbourhood name…", "Escribe el nombre de un barrio…")}
            autoComplete="off"
          />
        </label>

        <p>
          {filtered.length.toLocaleString(localeTag(locale))}{" "}
          {filtered.length === 1
            ? tr(locale, "area", "zona")
            : tr(locale, "areas", "zonas")}
          {query.trim()
            ? tr(locale, " matched", " encontradas")
            : tr(locale, " available", " disponibles")}
        </p>
      </div>

      <p className="density-caution">
        {tr(
          locale,
          "Directory only. Relative levels are shown on the map above, where the active Resident, Visitor or filter view defines the comparison.",
          "Solo directorio. Los niveles relativos se muestran en el mapa superior, donde la vista activa de Residente, Visitante o filtro define la comparación.",
        )}
      </p>

      {visible.length ? (
        <>
          <div className="area-grid">
            {visible.map((area) => {
              const duplicate = (duplicateNames.get(area.name.trim().toLocaleLowerCase()) ?? 0) > 1;
              return (
                <Link
                  className="area-card"
                  href={localeHref(locale, areaHref(area.id))}
                  key={area.stableId}
                >
                  <span className="area-city">
                    {area.cityName}
                    {area.parentName
                      ? ` · ${area.parentName}`
                      : duplicate
                        ? locale === "es"
                          ? ` · zona oficial ${area.sourceAreaId}`
                          : ` · official area ${area.sourceAreaId}`
                        : ""}
                  </span>
                  <h3>{area.name}</h3>
                  <small className="area-context">
                    {tr(
                      locale,
                      "Open the profile for local Resident and Visitor context.",
                      "Abre la ficha para ver el contexto local de Residente y Visitante.",
                    )}
                  </small>
                  <span className="arrow">{tr(locale, "View profile →", "Ver ficha →")}</span>
                </Link>
              );
            })}
          </div>

          {remaining > 0 ? (
            <button
              className="show-more"
              type="button"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              {tr(locale, "Show", "Mostrar")} {Math.min(PAGE_SIZE, remaining)}{" "}
              {tr(locale, "more", "más")}
              <small>
                {remaining.toLocaleString(localeTag(locale))}{" "}
                {tr(locale, "still hidden", "aún ocultas")}
              </small>
            </button>
          ) : null}
        </>
      ) : (
        <div className="notice">
          {tr(
            locale,
            "No stored area matches that name.",
            "Ninguna zona almacenada coincide con ese nombre.",
          )}
        </div>
      )}
    </div>
  );
}
