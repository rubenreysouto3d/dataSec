import Link from "next/link";
import { getCitySnapshot, getNeighbourhoods, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { localeFromValue, localeHref, localeTag, tr } from "@/lib/i18n";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const query = await searchParams;
  const locale = localeFromValue(query.lang);
  let areas = [] as Awaited<ReturnType<typeof getNeighbourhoods>>;
  let londonSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let madridSnapshot: Awaited<ReturnType<typeof getCitySnapshot>> = null;
  let error = false;

  try {
    areas = await getNeighbourhoods();
    const londonIds = areas.filter((area) => area.citySlug === "london").map((area) => area.id);
    const madridIds = areas.filter((area) => area.citySlug === "madrid").map((area) => area.id);
    [londonSnapshot, madridSnapshot] = await Promise.all([
      getCitySnapshot("london", londonIds),
      getCitySnapshot("madrid", madridIds),
    ]);
  } catch (caught) {
    if (process.env.GITHUB_PAGES !== "true") throw caught;
    error = true;
  }

  const cityCards = [
    {
      slug: "madrid",
      name: "Madrid",
      snapshot: madridSnapshot,
      count: areas.filter((area) => area.citySlug === "madrid").length,
    },
    {
      slug: "london",
      name: "London",
      snapshot: londonSnapshot,
      count: areas.filter((area) => area.citySlug === "london").length,
    },
  ] as const;

  const verificationLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(
        new Date(dataHealth.checkedAt),
      )
    : tr(locale, "pending", "pendiente");

  return (
    <main className="home-page home-page-v2">
      <section className="home-entry">
        <div className="home-entry-copy">
          <div className="eyebrow">
            {tr(locale, "Urban safety explorer", "Explorador de seguridad urbana")}
          </div>
          <h1>
            {tr(locale, "Pick a city.", "Elige una ciudad.")}
            <br />
            <em>{tr(locale, "Read the map.", "Lee el mapa.")}</em>
          </h1>
          <p>
            {tr(
              locale,
              "Official local data with separate Resident and Visitor context, verified before publication.",
              "Datos locales oficiales con contexto separado para residentes y visitantes, verificados antes de publicarse.",
            )}
          </p>
        </div>

        {error ? (
          <div className="notice">
            {tr(
              locale,
              "The validated data store is temporarily unavailable.",
              "El almacén de datos validados no está disponible temporalmente.",
            )}
          </div>
        ) : (
          <div
            className="home-city-choice"
            aria-label={tr(locale, "Choose a city", "Elige una ciudad")}
          >
            {cityCards.map((city) => (
              <Link
                className="home-city-choice-card"
                href={localeHref(locale, `/city/${city.slug}`)}
                key={city.slug}
              >
                <span className="home-city-choice-name">{city.name}</span>
                <span className="home-city-choice-meta">
                  <strong>{city.count.toLocaleString(localeTag(locale))}</strong>{" "}
                  {tr(locale, "areas", "zonas")}
                  <i aria-hidden="true">·</i>
                  <strong>{city.snapshot ? monthLabel(city.snapshot.month, locale) : "—"}</strong>
                </span>
                <b>{tr(locale, "Open map →", "Abrir mapa →")}</b>
              </Link>
            ))}
          </div>
        )}

        <div className="home-entry-note">
          <span>{tr(locale, "Official public sources", "Fuentes públicas oficiales")}</span>
          <span>{tr(locale, "Resident + visitor views", "Vistas para residente + visitante")}</span>
          <Link href={localeHref(locale, "/status")}>
            {tr(locale, "Data verified", "Datos verificados")} {verificationLabel}
          </Link>
          <Link href={localeHref(locale, "/methodology")}>
            {tr(locale, "How the data works", "Cómo funcionan los datos")}
          </Link>
        </div>
      </section>
    </main>
  );
}
