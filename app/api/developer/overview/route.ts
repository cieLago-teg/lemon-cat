import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { requireAdmin } from "@/lib/server/guard";
import { database } from "@/lib/server/db.cjs";
import { config } from "@/lib/server/config.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 后台只返回运营概览，不暴露其他用户的邮箱、宠物内容或原始上传文件。
export const GET = route("GET", async (request) => {
  await requireAdmin(request);
  const [users, pets, activeJobs, reviewJobs, worker] = await Promise.all([
    database().query("SELECT count(*)::int AS count FROM users"),
    database().query("SELECT count(*)::int AS count FROM pets"),
    database().query("SELECT count(*)::int AS count FROM generation_jobs WHERE state IN ('queued','submitting','polling','materializing')"),
    database().query("SELECT count(*)::int AS count FROM generation_jobs WHERE state='needs_review'"),
    database().query("SELECT 1 FROM worker_heartbeats WHERE updated_at>now()-interval '3 minutes' LIMIT 1")
  ]);
  const cfg = config();
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
