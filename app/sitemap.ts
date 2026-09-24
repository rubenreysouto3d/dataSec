import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { getNeighbourhoods } from "@/lib/data";
import { areaHref } from "@/lib/area-route";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rubenreysouto3d.github.io/dataSec").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  let areas: Awaited<ReturnType<typeof getNeighbourhoods>> = [];

  try {
    areas = await getNeighbourhoods();
  } catch {
    // A sitemap should still expose the stable top-level pages if the data store
    // is temporarily unavailable during a build.
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/city/london`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/city/madrid`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/methodology`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const areaEntries: MetadataRoute.Sitemap = areas.map((area) => ({
    url: `${base}${areaHref(area.id)}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...areaEntries];
}
