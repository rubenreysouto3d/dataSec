import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://data-sec.vercel.app").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: [
      { userAgent: "Claude-User", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-SearchBot", allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
