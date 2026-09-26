import type { MetadataRoute } from "next";
import { getNeighbourhoods } from "@/lib/data";
import { areaHref } from "@/lib/area-route";
import { localeHref } from "@/lib/i18n";

export const dynamic = "force-static";

function siteUrl() {
  const fallback =
    process.env.GITHUB_PAGES === "true"
      ? "https://rubenreysouto3d.github.io/dataSec"
      : "https://data-sec.vercel.app";
  return (process.env.NEXT_PUBLIC_SITE_URL ?? fallback).replace(/\/$/, "");
}

type Frequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

function localizedEntries(
  base: string,
  path: string,
  changeFrequency: Frequency,
  priority: number,
): MetadataRoute.Sitemap {
  const enPath = path;
  const esPath = localeHref("es", path);
  const enUrl = `${base}${enPath === "/" ? "" : enPath}`;
  const esUrl = `${base}${esPath}`;
  const languages = {
    en: enUrl,
    es: esUrl,
    "x-default": enUrl,
  };

  return [
    {
      url: enUrl,
      changeFrequency,
      priority,
      alternates: { languages },
    },
    {
      url: esUrl,
      changeFrequency,
      priority,
      alternates: { languages },
    },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];

  try {
    areas = await getNeighbourhoods();
  } catch {
    // Stable top-level pages remain visible if the data store is temporarily
    // unavailable while generating the sitemap.
  }

  const staticPaths: Array<[string, Frequency, number]> = [
    ["/", "weekly", 1],
    ["/city/london", "monthly", 0.9],
    ["/city/madrid", "monthly", 0.9],
    ["/city/london/resident", "monthly", 0.82],
    ["/city/london/visitor", "monthly", 0.82],
    ["/city/madrid/resident", "monthly", 0.82],
    ["/city/madrid/visitor", "monthly", 0.82],
    ["/city/london/trends", "monthly", 0.75],
    ["/city/madrid/trends", "monthly", 0.75],
    ["/status", "weekly", 0.55],
    ["/methodology", "monthly", 0.5],
    ["/disclaimer", "monthly", 0.35],
  ];

  const staticEntries = staticPaths.flatMap(([path, frequency, priority]) =>
    localizedEntries(base, path, frequency, priority),
  );

  const areaEntries = areas.flatMap((area) =>
    localizedEntries(base, areaHref(area.id), "monthly", 0.7),
  );

  return [...staticEntries, ...areaEntries];
}
