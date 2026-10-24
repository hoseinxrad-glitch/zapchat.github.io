import type { NextConfig } from "next";

const isStaticExport = process.env.BUILD_STATIC === "true";
const repoName = "zapchat.github.io";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  basePath: isStaticExport ? `/${repoName}` : "",
  assetPrefix: isStaticExport ? `/${repoName}/` : "",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Add CORS headers only for Render (standalone) build
  ...(isStaticExport ? {} : {
    async headers() {
      return [
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "*" },
            { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
            { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
