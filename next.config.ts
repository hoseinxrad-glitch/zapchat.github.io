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
};

export default nextConfig;
