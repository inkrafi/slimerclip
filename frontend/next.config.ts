import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set root directory agar Next.js tidak bingung dengan lockfile di direktori parent
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
