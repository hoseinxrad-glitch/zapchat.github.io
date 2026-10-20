import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Skip API routes during static export
  // They are served from Render backend
  experimental: {
    missingSuspenseWithCSRBailout: true,
  },
};

export default nextConfig;
