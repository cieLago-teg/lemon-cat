import { NextResponse } from "next/server";
import animationProviderModule from "@/lib/pet/animation-provider.js";
import { getAnimationTracker } from "@/lib/pet/task-store";

const { ANIMATION_PROVIDER_ID, getAnimationProviderAvailability } = animationProviderModule as {
  ANIMATION_PROVIDER_ID: "dashscope_wan";
  getAnimationProviderAvailability: (env: Record<string, unknown>) => {
    dashscope_wan: { available: boolean; envKey: string; reason: string };
  };
};


export async function GET(request: Request) {
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
}
