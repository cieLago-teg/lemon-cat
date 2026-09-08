import { NextResponse } from "next/server";
import animationProviderModule from "@/lib/pet/animation-provider.js";
import { getAnimationTracker } from "@/lib/pet/task-store";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

const { ANIMATION_PROVIDER_ID, getAnimationProviderAvailability } = animationProviderModule as {
  ANIMATION_PROVIDER_ID: "dashscope_wan";
  getAnimationProviderAvailability: (env: Record<string, unknown>) => {
    dashscope_wan: { available: boolean; envKey: string; reason: string };
  };
};

export const GET = route("GET", async (request) => {
  // 2026-09-08 1A 用户隔离：任务状态只对登录用户开放。
  await requireUser(request);
  const tracker = getAnimationTracker();
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");

  const availability = getAnimationProviderAvailability(process.env);

  const body: Record<string, unknown> = {
    availability,
    defaults: {
      provider: ANIMATION_PROVIDER_ID,
      dashscopeModel: process.env.DASHSCOPE_VIDEO_MODEL || "wan2.6-i2v-flash"
    }
  };

  if (taskId) {
    const status = tracker.get(taskId);
    body.task = status
      ? {
          taskId: status.taskId,
          stage: status.stage,
          percent: status.percent,
          message: status.message,
          videoUrl: status.videoUrl || null,
          error: status.error || null,
          updatedAt: status.updatedAt
        }
      : { taskId, missing: true };
  } else {
    // Return a snapshot of all active tasks (useful for debugging).
    body.activeTasks = tracker.listActive().map((s) => ({
      taskId: s.taskId,
      stage: s.stage,
      percent: s.percent,
      message: s.message
    }));
  }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
});
