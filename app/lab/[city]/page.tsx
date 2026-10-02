import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { cityNames, getCityBoundaries, getCityMapMetrics, getCitySafetySignals, getNeighbourhoods, type CitySlug } from "@/lib/data";
import { localeFromValue, localeHref, tr } from "@/lib/i18n";
import AtlasDesk from "./AtlasDesk";
import "./atlas.css";

// Deliberately isolated product-preview route. Do not index or replace the
// established site until the new end-to-end journey is verified and accepted.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DataSec Lab — A place is more than a colour",
  robots: { index: false, follow: false },
};

export default async function AtlasPreview({
  params, searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ lang?: string; area?: string; view?: string }>;
}) {
  const [{ city }, query] = await Promise.all([params, searchParams]);
  if (city !== "madrid" && city !== "london") notFound();
  const slug = city as CitySlug;
  const locale = localeFromValue(query.lang);
  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];
  let metrics: Awaited<ReturnType<typeof getCityMapMetrics>> = [];
  let boundaries: Awaited<ReturnType<typeof getCityBoundaries>> = [];
  let safetySignals: Awaited<ReturnType<typeof getCitySafetySignals>> = [];

  try {
    areas = await getNeighbourhoods(slug);
    const ids = areas.map((item) => item.id);
    [metrics, boundaries] = await Promise.all([
      getCityMapMetrics(slug, ids),
      getCityBoundaries(ids),
    ]);
    if (slug === "madrid") safetySignals = await getCitySafetySignals(slug, ids, metrics);
  } catch (error) {
    unstable_rethrow(error);
    return (
      <main className="atlas atlas-load-error">
        <span>DATASEC / LAB</span>
        <h1>{tr(locale, "Official data unavailable.", "Datos oficiales no disponibles.")}</h1>
        <p>{tr(locale, "The prototype will not invent substitute figures.", "El prototipo no inventará cifras alternativas.")}</p>
        <Link href={localeHref(locale, "/")}>{tr(locale, "Return home", "Volver al inicio")}</Link>
      </main>
    );
  }

  const requestedArea = areas.find((area) => area.id === query.area);
  // Neutral, explicitly non-recommended worked examples; the URL can override.
  const sample = areas.find((area) => area.name === (slug === "madrid" ? "Sol" : "Clissold"));
  return <AtlasDesk
    city={slug}
    areas={areas}
    metrics={metrics}
    boundaries={boundaries}
    safetySignals={safetySignals}
    initialAreaId={requestedArea?.id ?? (query.area ? null : sample?.id ?? null)}
    initialMode={query.view === "visitor" ? "visitor" : "resident"}
    locale={locale}
  />;
}
