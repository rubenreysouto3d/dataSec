"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { localeHref, localeTag, tr, type Locale } from "@/lib/i18n";
import type { CitySlug } from "@/lib/data";
import { resolvePlaceToArea } from "@/lib/public-data-client";

type AreaOption = {
  id: string;
  name: string;
  parentName?: string | null;
  citySlug: CitySlug;
};
type CityOption = { slug: CitySlug; count: number; period: string | null };
type Props = {
  locale: Locale;
  areas: AreaOption[];
  cities: CityOption[];
  checkedLabel: string;
  available: boolean;
};

function normalise(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export default function HomeGateway({ locale, areas, cities, checkedLabel, available }: Props) {
  const [mode, setMode] = useState<"resident" | "visitor">("resident");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressMatch, setAddressMatch] = useState<Awaited<ReturnType<typeof resolvePlaceToArea>>>(null);
  const matches = useMemo(() => {
    const term = normalise(search);
    if (!term) return [];
    return areas.filter((area) => normalise(area.name + " " + (area.parentName || "") + " " + area.citySlug).includes(term))
      .sort((a, b) => {
        const aStart = normalise(a.name).startsWith(term) ? 0 : 1;
        const bStart = normalise(b.name).startsWith(term) ? 0 : 1;
        return aStart - bStart || a.name.localeCompare(b.name, localeTag(locale));
      }).slice(0, 7);
  }, [areas, search, locale]);

  const cityTerm = normalise(search);
  const matchingCity = cityTerm.length >= 2
    ? (["madrid", "london"] as const).find((city) =>
      (city === "madrid" ? "madrid" : "london").startsWith(cityTerm) ||
      (city === "london" && "londres".startsWith(cityTerm)))
    : undefined;

  const goArea = (area: AreaOption) => localeHref(locale,
    "/lab/" + area.citySlug + "?view=" + mode + "&area=" + encodeURIComponent(area.id));
  const goCity = (slug: CitySlug) => localeHref(locale, "/lab/" + slug + "?view=" + mode);

  async function lookupAddress() {
    const exactQuery = search.trim();
    if (exactQuery.length < 4 || addressLoading) return;
    setAddressLoading(true);
    setAddressError("");
    setAddressMatch(null);
    try {
      // Only an explicit click sends this text to the prototype geocoder.
      const result = await resolvePlaceToArea(exactQuery);
      if (result) setAddressMatch(result);
      else setAddressError(tr(locale,
        "No location matched the current Madrid/London coverage. Add the city and full address.",
        "No encontramos ese lugar en la cobertura actual de Madrid o Londres. Añade ciudad y dirección completa."));
    } catch {
      setAddressError(tr(locale, "Address lookup is temporarily unavailable.", "La búsqueda por dirección no está disponible temporalmente."));
    } finally {
      setAddressLoading(false);
    }
  }

  return (
    <main className="home-gateway" id="main-content">
      <header className="hg-header">
        <Link className="hg-wordmark" href={localeHref(locale, "/")}>
          <span aria-hidden="true" className="hg-mark">◈</span><strong>dataSec</strong>
        </Link>
        <div className="hg-nav">
          <Link href={localeHref(locale, "/methodology")}>{tr(locale, "Methodology", "Metodología")}</Link>
          <Link href={localeHref(locale, "/status")}>{tr(locale, "Data status", "Estado de datos")}</Link>
          <Link href={localeHref(locale === "es" ? "en" : "es", "/")}>{locale === "es" ? "EN" : "ES"}</Link>
        </div>
      </header>

      <section className="hg-main">
        <div className="hg-hero">
          <div className="hg-hero-copy">
            <span className="hg-kicker">DATASEC / {tr(locale, "UNDERSTAND A PLACE", "ENTENDER UN LUGAR")}</span>
            <h1>{tr(locale, "A city is not", "Una ciudad no es")}<br/>
              <em>{tr(locale, "one colour.", "un solo color.")}</em></h1>
            <p>{tr(locale,
              "Find a neighbourhood. See the actual records, the geographic context and what the data cannot tell you.",
              "Encuentra un barrio. Consulta los registros reales, su contexto geográfico y lo que los datos no permiten saber.")}</p>
          </div>
          <div className="hg-orbit" aria-hidden="true">
            <div className="hg-orbit-circle one"/><div className="hg-orbit-circle two"/>
            <div className="hg-orbit-circle three"/><div className="hg-orbit-cross">+</div>
            <span className="hg-orbit-label top">40.4168° N</span>
            <span className="hg-orbit-label bottom">51.5072° N</span>
            <span className="hg-orbit-label left">LOCAL / VERIFIED</span>
          </div>
        </div>
        <section className="hg-launch" aria-labelledby="hg-lookup-title">
          <div className="hg-launch-header">
            <div><span className="hg-kicker">{tr(locale, "YOUR STARTING POINT", "PUNTO DE PARTIDA")}</span>
              <h2 id="hg-lookup-title">{tr(locale, "Which area?", "¿Qué zona buscas?")}</h2></div>
            <div className="hg-mode" role="group" aria-label={tr(locale, "Purpose", "Objetivo")}>
              <button type="button" className={mode === "resident" ? "active" : ""} aria-pressed={mode === "resident"}
                onClick={() => setMode("resident")}>{tr(locale, "I might live there", "Para vivir")}</button>
              <button type="button" className={mode === "visitor" ? "active" : ""} aria-pressed={mode === "visitor"}
                onClick={() => setMode("visitor")}>{tr(locale, "I'm visiting", "Para visitar")}</button>
            </div>
          </div>
          <div className="hg-search-wrap">
            <div className="hg-search">
              <span aria-hidden="true">⌕</span>
              <label className="hg-sr-only" htmlFor="hg-area">{tr(locale, "Search a neighbourhood", "Buscar un barrio")}</label>
              <input id="hg-area" type="search" autoComplete="off"
                placeholder={tr(locale, "Neighbourhood, city or address…", "Barrio, ciudad o dirección…")}
                value={search} disabled={!available}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); setAddressMatch(null); setAddressError(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchOpen(false);
                  if (event.key === "Enter" && (matchingCity || matches[0])) {
                    event.preventDefault();
                    window.location.assign(matchingCity ? goCity(matchingCity) : goArea(matches[0]));
                  }
                }}/>
              {search ? <button type="button" aria-label={tr(locale, "Clear search", "Borrar búsqueda")}
                onClick={() => { setSearch(""); setSearchOpen(false); setAddressMatch(null); setAddressError(""); }}>×</button> : null}
            </div>
            {searchOpen && search.trim() ? (
              <div className="hg-results" aria-label={tr(locale, "Matching areas", "Zonas coincidentes")}>
                {matchingCity ? (
                  <Link className="hg-city-result" href={goCity(matchingCity)}>
                    <span><strong>{tr(locale, "Explore the city map", "Explorar el mapa de la ciudad")}</strong>
                      <small>{matchingCity === "madrid" ? "Madrid" : "London"}</small></span>
                    <span className="hg-result-city">↗</span>
                  </Link>
                ) : null}
                {matches.map((area) => (
                  <Link href={goArea(area)} key={area.id}>
                    <span><strong>{area.name}</strong><small>{area.parentName || (area.citySlug === "madrid" ? "Madrid" : "London")}</small></span>
                    <span className="hg-result-city">{area.citySlug === "madrid" ? "Madrid" : "London"} ↗</span>
                  </Link>
                ))}
                {!matches.length && !matchingCity ?
                  <p>{tr(locale, "No official neighbourhood matches. For a precise address, use the lookup below.", "No coincide ningún barrio oficial. Para una dirección concreta, utiliza la búsqueda siguiente.")}</p> : null}
                {search.trim().length >= 4 ? (
                  <div className="hg-address-lookup">
                    <button type="button" className="hg-lookup-btn" onClick={lookupAddress}
                      disabled={addressLoading}>
                      {addressLoading
                        ? tr(locale, "Matching address…", "Buscando dirección…")
                        : tr(locale, "Look up this address or place ↗", "Buscar esta dirección o lugar ↗")}
                    </button>
                    <small>{tr(locale,
                      "Only when you click, the query is sent to OpenStreetMap's prototype geocoder. Verify the location before opening.",
                      "Solo al pulsar, la consulta se envía al geocodificador de prueba de OpenStreetMap. Comprueba el lugar antes de abrirlo.")}{" "}
                      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
                    </small>
                    {addressMatch ? <div className="hg-match" role="status">
                      <span>{tr(locale, "Check this matched place", "Comprueba el lugar encontrado")}</span>
                      <strong>{addressMatch.matchedPlace}</strong>
                      <small>{addressMatch.name} · {addressMatch.citySlug === "madrid" ? "Madrid" : "London"}</small>
                      <Link href={goArea(addressMatch)}>
                        {tr(locale, "Open this area on the map →", "Abrir esta zona en el mapa →")}
                      </Link>
                    </div> : null}
                    {addressError ? <p role="alert">{addressError}</p> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="hg-search-foot">{tr(locale,
            "Official neighbourhood names. For a broad view, choose a city below.",
            "Nombres oficiales de barrios. Para explorar sin buscar, elige una ciudad.")}</div>
        </section>
        <section className="hg-cities" aria-labelledby="hg-cities-title">
          <div className="hg-section-heading"><h2 id="hg-cities-title">{tr(locale, "Or start on a map", "O empieza por el mapa")}</h2>
            <span>{tr(locale, "LIVE DATA / TWO CITIES", "DATOS ACTIVOS / DOS CIUDADES")}</span></div>
          <div className="hg-city-grid">
            {cities.map((city, index) => (
              <Link className="hg-city" key={city.slug} href={goCity(city.slug)}>
                <div className="hg-city-top"><span>{"0" + (index + 1)} / 02</span>
                  <span>{tr(locale, "Explore map", "Explorar mapa")} ↗</span></div>
                <strong>{city.slug === "madrid" ? "Madrid" : "London"}</strong>
                <div className="hg-city-bottom">
                  <span>{city.count.toLocaleString(localeTag(locale))} {tr(locale, "mapped areas", "zonas en el mapa")}</span>
                  <span>{tr(locale, "Latest source", "Última fuente")}: {city.period || "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
        {!available ? <p role="status" className="hg-unavailable">{tr(locale,
          "Official data is temporarily unavailable; neighbourhood search is paused.",
          "Los datos oficiales no están disponibles temporalmente; la búsqueda está pausada.")}</p> : null}
      </section>
      <footer className="hg-footer">
        <p>{tr(locale,
          "Recorded patterns, not predictions of personal safety. Each city has its own source and methodology.",
          "Patrones registrados, no predicciones de seguridad personal. Cada ciudad tiene su propia fuente y metodología.")}</p>
        <div>
          <span>{tr(locale, "Last data check", "Última comprobación")}: {checkedLabel}</span>
          <Link href={localeHref(locale, "/methodology")}>{tr(locale, "How to read the data", "Cómo interpretar los datos")} ↗</Link>
          <Link href={localeHref(locale, "/disclaimer")}>{tr(locale, "Limitations", "Limitaciones")}</Link>
        </div>
      </footer>
    </main>
  );
}
