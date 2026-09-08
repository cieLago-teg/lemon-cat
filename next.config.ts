import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本地开发服务与独立验收构建可并行，避免它们争用同一个 .next 目录。
  distDir: process.env.LEMON_NEXT_DIST_DIR || ".next",
  devIndicators: false,
  async rewrites() {
    return { beforeFiles: [{ source: '/pet-videos/:file*', destination: '/api/pet/video/:file*' }], afterFiles: [], fallback: [] };
  },
  // Native / CJS server deps must not be bundled by the Next server compiler.
  serverExternalPackages: ["pg", "pino", "pino-abstract-transport"]
};

export default nextConfig;
