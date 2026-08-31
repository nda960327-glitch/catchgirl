import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
