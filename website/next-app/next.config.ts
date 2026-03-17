import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  transpilePackages: ["komently-sdk"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
