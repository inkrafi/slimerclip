import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Folder build alternatif (mis. NEXT_DIST_DIR=.next-test) agar build uji tidak bentrok dengan `next dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Set root directory agar Next.js tidak bingung dengan lockfile di direktori parent
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
