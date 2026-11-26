import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      new URL("https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/**"),
    ],
  },
};

export default nextConfig;
