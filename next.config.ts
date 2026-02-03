import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure for subpath deployment at datumlabs.xyz/aave-dashboard
  basePath: '/aave-dashboard',
  assetPrefix: '/aave-dashboard',

  images: {
    unoptimized: true, // Required for basePath to work properly
  },
};

export default nextConfig;
