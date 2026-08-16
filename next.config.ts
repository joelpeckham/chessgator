import type { NextConfig } from "next";

/**
 * Static export only: no Node.js server after `next build`.
 * Image Optimization requires a runtime server, so local images stay unoptimized.
 * Response headers (e.g. COOP/COEP) must be configured on the static host, not here.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  allowedDevOrigins: ["192.168.4.92"],
};

export default nextConfig;
