import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Folder build alternatif (mis. NEXT_DIST_DIR=.next-test) agar build uji tidak bentrok dengan `next dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Video panjang dan pendek kini satu menu
  async redirects() {
    return [
      { source: "/longform", destination: "/proyek-video", permanent: false },
      { source: "/longform/:id", destination: "/proyek-video/:id", permanent: false },
      { source: "/video-pendek", destination: "/proyek-video?tab=short", permanent: false },
      { source: "/video-pendek/:id", destination: "/proyek-video/:id", permanent: false },
    ];
  },
  // Set root directory agar Next.js tidak bingung dengan lockfile di direktori parent
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
