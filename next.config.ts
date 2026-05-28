import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks /_next/* from non-localhost origins in dev. Required for phone testing.
  allowedDevOrigins: ["192.168.1.78"],
};

export default nextConfig;
