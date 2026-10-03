"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Neighbourhood } from "@/lib/data";
import LocateButton from "@/components/LocateButton";
import { resolvePlaceToArea } from "@/lib/public-data-client";
import { areaHref } from "@/lib/area-route";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";

type Props = {
  areas: Neighbourhood[];
  error: boolean;
};

export default function SearchClient({ areas, error }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const locale = localeFromValue(searchParams.get("lang"));
  const initialView = searchParams.get("view") === "visitor" ? "visitor" : "resident";
  const [view, setView] = useState<"resident" | "visitor">(initialView);
  const [value, setValue] = useState(q);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");

  useEffect(() => setValue(q), [q]);

  const query = q.trim().toLowerCase();
  const results = useMemo(
    () =>
      query
        ? areas
            .filter(
              (area) =>
                area.name.toLowerCase().includes(query) ||
                area.parentName?.toLowerCase().includes(query),
            )
            .sort((a, b) => {
              const aStarts = areaStarts(a.name, query);
              const bStarts = areaStarts(b.name, query);
              return aStarts - bStarts || a.name.localeCompare(b.name);
            })
            .slice(0, 60)
        : areas.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60),
    [areas, query],
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    router.push(
      localeHref(locale, next
        ? `/search?q=${encodeURIComponent(next)}&view=${view}`
        : `/search?view=${view}`),
    );
  }

  async function findPlace() {
    const text = q.trim();
    if (!text || placeLoading) return;

    setPlaceLoading(true);
    setPlaceError("");
    try {
      const area = await resolvePlaceToArea(text);
      if (!area) {
        setPlaceError(tr(locale, "That place could not be matched to current London or Madrid coverage.", "Ese lugar no se pudo asociar a la cobertura actual de Londres o Madrid."));
        return;
      }
      router.push(localeHref(locale,
        `/explore/${area.citySlug}?view=${view}&area=${encodeURIComponent(area.id)}`,
      ));
    } catch {
      setPlaceError(tr(locale, "Place lookup is temporarily unavailable.", "La búsqueda de lugares no está disponible temporalmente."));
    } finally {
      setPlaceLoading(false);
    }
  }

  return (
    <>
      <div className="eyebrow">{tr(locale, "London + Madrid area finder", "Buscador de zonas de Londres + Madrid")}</div>
      <h1>
        {query
          ? <>{tr(locale, "Results for", "Resultados para")} <em>“{q.trim()}”</em></>
          : tr(locale, "Browse areas", "Explorar zonas")}
      </h1>

      <div className="search-task-intent">
        <span>{tr(locale, "What are you exploring?", "¿Qué quieres consultar?")}</span>
        <div role="group" aria-label={tr(locale, "Purpose", "Objetivo")}>
          <button type="button" className={view === "resident" ? "is-active" : ""} aria-pressed={view === "resident"} onClick={() => setView("resident")}>{tr(locale, "Living here", "Vivir aquí")}</button>
          <button type="button" className={view === "visitor" ? "is-active" : ""} aria-pressed={view === "visitor"} onClick={() => setView("visitor")}>{tr(locale, "Visiting", "De visita")}</button>
        </div>
      </div>
      <form className="search-form search-form-page" onSubmit={submit}>
        <label className="sr-only" htmlFor="search-again">{tr(locale, "Search an area", "Buscar una zona")}</label>
        <input
          id="search-again"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={tr(locale, "Try Camden, Brixton, Sol, Lavapiés…", "Prueba Camden, Brixton, Sol, Lavapiés…")}
        />
        <button type="submit">{tr(locale, "Search", "Buscar")}</button>
      </form>
      <LocateButton locale={locale} />
      {query ? (
        <div className="place-lookup">
          <button type="button" onClick={findPlace} disabled={placeLoading}>
            {placeLoading
              ? tr(locale, "Matching place…", "Buscando lugar…")
              : tr(locale, "Find this place or address", "Buscar este lugar o dirección")}
          </button>
          <span>
            {tr(
              locale,
              "Uses OpenStreetMap Nominatim only when you click this button, then matches the result to dataSec's stored official boundary.",
              "Usa OpenStreetMap Nominatim solo al pulsar este botón y después asocia el resultado al límite oficial almacenado por dataSec.",
            )}
            {" "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
          </span>
          {placeError ? <small>{placeError}</small> : null}
        </div>
      ) : null}

      {error ? (
        <div className="notice">
          {tr(
            locale,
            "The stored dataset could not be reached, so no fallback results are being fabricated.",
            "No se pudo acceder al conjunto de datos almacenado, por lo que no se inventan resultados alternativos.",
          )}
        </div>
      ) : (
        <>
          <p className="result-count">
            {query
              ? locale === "es"
                ? `${results.length} zona${results.length === 1 ? "" : "s"} encontrada${results.length === 1 ? "" : "s"}`
                : `${results.length} matching area${results.length === 1 ? "" : "s"}`
              : locale === "es"
                ? `Mostrando ${results.length} zonas`
                : `Showing ${results.length} areas`}
          </p>
          {results.length === 0 ? (
            <div className="notice">
              {tr(
                locale,
                "No stored area matched that name. Try a broader spelling or nearby district/neighbourhood.",
                "Ninguna zona almacenada coincide con ese nombre. Prueba una búsqueda más amplia o un distrito/barrio cercano.",
              )}
            </div>
          ) : (
            <div className="search-results">
              {results.map((area) => (
                <article className="search-task-result" key={area.id}>
                  <div>
                    <span>{area.cityName}{area.parentName ? ` · ${area.parentName}` : ""}</span>
                    <strong>{area.name}</strong>
                  </div>
                  <div className="search-task-actions">
                    <Link href={localeHref(locale,
                      `/explore/${area.citySlug}?view=${view}&area=${encodeURIComponent(area.id)}`,
                    )}>
                      {tr(locale, "View in map →", "Ver en el mapa →")}
                    </Link>
                    <Link href={localeHref(locale, areaHref(area.id))}>
                      {tr(locale, "Full profile", "Ficha completa")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function areaStarts(name: string, query: string) {
  return name.toLowerCase().startsWith(query) ? 0 : 1;
}
