export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/lib/server/logger.cjs");
    const { config } = await import("@/lib/server/config.cjs");
    const cfg = config();
    logger.info(
      {
        version: process.env.npm_package_version || "0.1.0",
        env: process.env.NODE_ENV || "development",
        provider: cfg.provider,
        storage: cfg.storage,
        origin: cfg.origin,
        databaseConfigured: Boolean(cfg.databaseUrl),
        inviteConfigured: Boolean(cfg.invite)
      },
      "lemon-cat service starting"
    );
  }
}
