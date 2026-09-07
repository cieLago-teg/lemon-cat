import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { config } from "@/lib/server/config.cjs";
import { database } from "@/lib/server/db.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.npm_package_version || "0.1.0";

export const GET = route("GET", async (_request, _context, { log }) => {
  const cfg = config();
  const checks: Record<string, string> = {};
  let healthy = true;

  if (cfg.databaseUrl) {
    try {
      await database().query("SELECT 1");
      checks.database = "ok";
    } catch (err) {
      healthy = false;
      checks.database = "error";
      log.error({ err }, "health database connectivity check failed");
    }
  } else {
    checks.database = "not_configured";
  }

  const payload = {
    status: healthy ? "ok" : "degraded",
    version: VERSION,
    env: process.env.NODE_ENV || "development",
    provider: cfg.provider,
    storage: cfg.storage,
    databaseConfigured: Boolean(cfg.databaseUrl),
    railwayAssetPipelineVerified: false,
    checks
  };

  return NextResponse.json(payload, { status: healthy ? 200 : 503 });
});
