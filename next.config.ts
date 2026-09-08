import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return { beforeFiles: [{ source: '/pet-videos/:file*', destination: '/api/pet/video/:file*' }], afterFiles: [], fallback: [] };
  },
  // Native / CJS server deps must not be bundled by the Next server compiler.
  serverExternalPackages: ["pg", "pino", "pino-abstract-transport"]
};

export default nextConfig;
