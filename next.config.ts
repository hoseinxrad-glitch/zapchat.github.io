import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip building API routes for static export
  // (They will be served from Render backend instead)
  outputFileTracingIncludes: {},
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
