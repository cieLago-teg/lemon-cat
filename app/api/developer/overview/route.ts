import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { database } from "@/lib/server/db.cjs";
import { config } from "@/lib/server/config.cjs";
import { HttpError } from "@/lib/server/errors.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 本地 MVP 的维护面板不需要账号；公网配置下它直接不存在，避免误带上线。
export const GET = route("GET", async () => {
  const cfg = config();
  const hostname = new URL(cfg.origin).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) throw new HttpError(404, "Not found");
  const [users, pets, activeJobs, reviewJobs, worker] = await Promise.all([
    database().query("SELECT count(*)::int AS count FROM users"),
    database().query("SELECT count(*)::int AS count FROM pets"),
    database().query("SELECT count(*)::int AS count FROM generation_jobs WHERE state IN ('queued','submitting','polling','materializing')"),
    database().query("SELECT count(*)::int AS count FROM generation_jobs WHERE state='needs_review'"),
    database().query("SELECT 1 FROM worker_heartbeats WHERE updated_at>now()-interval '3 minutes' LIMIT 1")
  ]);
  return NextResponse.json({
    users: users.rows[0].count,
    pets: pets.rows[0].count,
    activeJobs: activeJobs.rows[0].count,
    reviewJobs: reviewJobs.rows[0].count,
    worker: worker.rowCount ? "ok" : "not_running",
    provider: cfg.provider,
    storage: cfg.storage
  });
});
