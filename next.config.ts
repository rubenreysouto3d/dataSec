import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";
const basePath = githubPages ? "/dataSec" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(githubPages
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
      }
    : {
        async headers() {
          return [
            {
              source: "/robots.txt",
              headers: [
                {
                  key: "Cache-Control",
                  value: "no-store, no-cache, max-age=0, must-revalidate",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
