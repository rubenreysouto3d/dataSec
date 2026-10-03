import type { MetadataRoute } from "next";

/** Same mobile product, not a separate native client. Live datasets require connectivity. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "dataSec — Explore a place",
    short_name: "dataSec",
    description: "Explore recorded urban context for a specific place and its limits.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f3ef",
    theme_color: "#102b30",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
