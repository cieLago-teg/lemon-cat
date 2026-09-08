import { NextResponse } from "next/server";
import live2dTargetModule from "@/lib/pet/live2d-target.js";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

const { getLive2DStatus } = live2dTargetModule as {
  getLive2DStatus: (projectRoot: string) => {
    available: boolean;
    source: "custom" | "sample_only" | "missing";
    modelPath: string | null;
    message: string;
  };
};

export const GET = route("GET", async (request) => {
  // 2026-09-08 1A 用户隔离：所有 /api/* 统一要求登录（/health 除外）。
  await requireUser(request);
  const status = getLive2DStatus(process.cwd());
  return NextResponse.json({
    available: status.available,
    source: status.source,
    message: status.message
  });
});
