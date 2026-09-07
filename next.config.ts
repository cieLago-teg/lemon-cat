import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Native / CJS server deps must not be bundled by the Next server compiler.
  serverExternalPackages: ["pg", "pino", "pino-abstract-transport"]
};

export default nextConfig;
