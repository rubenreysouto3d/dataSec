import { getCitySnapshot, getNeighbourhoods, monthLabel } from "@/lib/data";
import { dataHealth } from "@/lib/generated-health";
import { localeFromValue, localeTag, tr } from "@/lib/i18n";
import HomeGateway from "./HomeGateway";
import "./home-gateway.css";

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
  let available = true;

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
    available = false;
  }

  const cities = [
    { slug: "madrid" as const, count: areas.filter((area) => area.citySlug === "madrid").length,
      period: madridSnapshot ? monthLabel(madridSnapshot.month, locale) : null },
    { slug: "london" as const, count: areas.filter((area) => area.citySlug === "london").length,
      period: londonSnapshot ? monthLabel(londonSnapshot.month, locale) : null },
  ];
  const checkedLabel = dataHealth.checkedAt
    ? new Intl.DateTimeFormat(localeTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(new Date(dataHealth.checkedAt))
    : tr(locale, "pending", "pendiente");

  return <HomeGateway locale={locale} areas={areas.map((area) => ({
    id: area.id, name: area.name, parentName: area.parentName, citySlug: area.citySlug,
  }))} cities={available ? cities : []} checkedLabel={checkedLabel} available={available}/>;
}
