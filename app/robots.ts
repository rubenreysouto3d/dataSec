import type { MetadataRoute } from "next";

export const dynamic = "force-static";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rubenreysouto3d.github.io/dataSec").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const indexSite = process.env.NEXT_PUBLIC_INDEX_SITE === "true";
  const base = siteUrl();

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
