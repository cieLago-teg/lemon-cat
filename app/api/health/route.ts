import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { config } from "@/lib/server/config.cjs";
import { database } from "@/lib/server/db.cjs";
import { checkStorage } from '@/lib/server/assets.cjs';

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
      const workers = await database().query("SELECT 1 FROM worker_heartbeats WHERE updated_at>now()-interval '3 minutes' LIMIT 1");
      checks.worker = workers.rowCount ? 'ok' : 'not_running';
      if (!workers.rowCount) healthy = false;
    } catch (err) {
      healthy = false;
      checks.database = "error";
      log.error({ err }, "health database connectivity check failed");
    }
  } else {
    healthy = false;
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
  try { checks.storage = await checkStorage(); }
  catch (err) { checks.storage = 'error'; healthy = false; log.error({ err }, 'health storage check failed'); }
  payload.status = healthy ? 'ok' : 'degraded';

  return NextResponse.json(payload, { status: healthy ? 200 : 503 });
});
