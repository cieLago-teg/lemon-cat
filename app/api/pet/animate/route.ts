import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import animationProviderModule from "@/lib/pet/animation-provider.js";
import dashscopeVideoConfigModule from "@/lib/pet/dashscope-video-config.js";

const { ANIMATION_PROVIDER_ID, getAnimationProviderAvailability } =
  animationProviderModule as {
    ANIMATION_PROVIDER_ID: "dashscope_wan";
    getAnimationProviderAvailability: (env: Record<string, unknown>) => {
      dashscope_wan: { available: boolean; envKey: string; reason: string };
    };
  };
const { resolveDashscopeVideoBaseUrl } = dashscopeVideoConfigModule as {
  resolveDashscopeVideoBaseUrl: (env: Record<string, unknown>) => string;
};

import { mattingVideo } from "@/lib/pet/rvm-matting.js";
import { buildIdlePrompt as buildIdlePromptWithStyle } from "@/lib/pet/animation-prompt.js";
import { createAnimationTracker } from "@/lib/pet/animation-tracker.js";
import { parseLocalResultImagePath, getResultImageFilePath } from "@/lib/db/archive";

// In-process tracker shared by /api/pet/animate (writer) and
// /api/pet/animation-status (reader). In dev mode Next.js may reload the
// route module; we cache the tracker on globalThis so state survives HMR.
type GlobalWithTracker = typeof globalThis & {
  __petAnimationTracker?: ReturnType<typeof createAnimationTracker>;
};
const globalAny = globalThis as GlobalWithTracker;
if (!globalAny.__petAnimationTracker) {
  globalAny.__petAnimationTracker = createAnimationTracker();
}
const tracker = globalAny.__petAnimationTracker;

function ensureVideoDir() {
  const dir = path.join(process.cwd(), "public", "pet-videos");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function buildIdlePrompt(input: string, styleHint?: string) {
  // Delegate to the style-aware helper so different archive styles (pixel,
  // sticker, realistic, …) automatically get the right constraints attached
  // to the prompt. See lib/pet/animation-prompt.js for the rules.
  return buildIdlePromptWithStyle(input, styleHint ?? "");
}

async function fetchImageBuffer(sourceUrl: string, requestUrl: string) {
  // 1. 尝试直接从本地文件系统读取档案图，绕过网络请求，避免 Node.js fetch localhost:3000 的网络问题
  const local = parseLocalResultImagePath(sourceUrl);
  if (local) {
    const filePath = getResultImageFilePath(local.archiveId, local.index, local.ext);
    if (fs.existsSync(filePath)) {
      const bytes = fs.readFileSync(filePath);
      const contentType = `image/${local.ext === "jpg" ? "jpeg" : local.ext}`;
      return { bytes, contentType };
    }
  }

  // 2. 如果不是本地档案图，或者文件不存在，回退到网络请求
  const target = sourceUrl.startsWith("/") ? new URL(sourceUrl, requestUrl).toString() : sourceUrl;
  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`参考图下载失败 (${response.status})`);
  }
  const contentType = String(response.headers.get("content-type") || "image/png");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("参考图为空");
  }
  return {
    bytes,
    contentType
  };
}

function getDashscopeBaseUrl() {
  return resolveDashscopeVideoBaseUrl(process.env);
}

async function pollDashscopeTask(taskId: string, apiKey: string, onStatus?: (s: string) => void) {
  const taskUrl = `${getDashscopeBaseUrl().replace(/\/$/, "")}/tasks/${taskId}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(taskUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    const payload = (await response.json()) as {
      output?: {
        task_status?: string;
        message?: string;
        results?: { video_url?: string } | Array<{ video_url?: string }>;
        video_url?: string;
      };
      message?: string;
    };
    if (!response.ok) {
      throw new Error(payload?.message || `Wan 查询失败 (${response.status})`);
    }
    const status = payload.output?.task_status;
    if (typeof onStatus === "function") {
      try { onStatus(status || "Unknown"); } catch { /* ignore */ }
    }
    if (status === "SUCCEEDED") {
      const results = payload.output?.results;
      if (Array.isArray(results)) {
        const hit = results.find((item) => typeof item?.video_url === "string");
        if (hit?.video_url) return hit.video_url;
      } else if (results && typeof results === "object" && typeof results.video_url === "string") {
        return results.video_url;
      }
      if (typeof payload.output?.video_url === "string") {
        return payload.output.video_url;
      }
      throw new Error("Wan 未返回视频地址");
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(payload.output?.message || payload.message || "Wan 动画生成失败");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Wan 生成超时，请稍后再试");
}

async function generateWithDashscope(
  apiKey: string,
  prompt: string,
  sourceImageUrl: string,
  onStatus?: (s: string) => void
) {
  const response = await fetch(`${getDashscopeBaseUrl().replace(/\/$/, "")}/services/aigc/video-generation/video-synthesis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable"
    },
    body: JSON.stringify({
      model: process.env.DASHSCOPE_VIDEO_MODEL || "wan2.6-i2v-flash",
      input: {
        prompt,
        img_url: sourceImageUrl
      },
      parameters: {
        resolution: "720P",
        watermark: false,
        prompt_extend: true,
        audio: false
      }
    })
  });
  const payload = (await response.json()) as {
    output?: { task_id?: string; task_status?: string; results?: { video_url?: string } };
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload?.message || `Wan 请求失败 (${response.status})`);
  }

  if (payload.output?.task_status === "SUCCEEDED" && payload.output?.results?.video_url) {
    if (typeof onStatus === "function") {
      try { onStatus("SUCCEEDED"); } catch { /* ignore */ }
    }
    return payload.output.results.video_url;
  }
  if (!payload.output?.task_id) {
    throw new Error("Wan 未返回任务 ID");
  }
  return pollDashscopeTask(payload.output.task_id, apiKey, onStatus);
}

async function saveVideoToPublic(videoUrl: string, provider: string) {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`生成视频下载失败 (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("生成视频为空");
  }
  const contentType = String(response.headers.get("content-type") || "");
  const ext = contentType.includes("video/webm") || /\.webm($|\?)/i.test(videoUrl) ? ".webm" : ".mp4";
  const fileName = `${Date.now()}-${provider}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const dir = ensureVideoDir();
  fs.writeFileSync(path.join(dir, fileName), bytes);
  return `/pet-videos/${fileName}`;
}

// Run the actual generation + matting pipeline for a single task in the
// background. This is invoked via setImmediate from POST so the front-end
// receives a taskId immediately and can poll for progress.
async function runJobForTask(
  taskId: string,
  ctx: {
    prompt: string;
    imageUrl: string;
    sourceImageUrl: string;
    requestUrl: string;
  }
) {
  const onStatus = (s: string) => {
    try { tracker.setPolling(taskId, s); } catch { /* ignore */ }
  };
  const tickInterval = setInterval(() => {
    try { tracker.tickWithoutStatus(taskId, 1000); } catch { /* ignore */ }
  }, 1000);
  try {
    const apiKey = String(process.env.DASHSCOPE_API_KEY || "");
    let finalSourceUrl = ctx.sourceImageUrl;
    if (finalSourceUrl.startsWith("/") || finalSourceUrl.includes("localhost")) {
      const { bytes, contentType } = await fetchImageBuffer(finalSourceUrl, ctx.requestUrl);
      finalSourceUrl = `data:${contentType};base64,${bytes.toString("base64")}`;
    }

    const upstreamUrl = await generateWithDashscope(
      apiKey,
      ctx.prompt,
      finalSourceUrl,
      onStatus
    );
    const localVideoUrl = await saveVideoToPublic(upstreamUrl, "dashscope_wan");

    let finalVideoUrl = localVideoUrl;
    try {
      const inputVideoAbsPath = path.join(process.cwd(), "public", localVideoUrl.replace(/^\//, ""));
      const mattedFileName = localVideoUrl.split("/").pop()!.replace(/\.[^.]+$/, "") + "-matted.webm";
      const mattedVideoAbsPath = path.join(process.cwd(), "public", "pet-videos", mattedFileName);
      await mattingVideo(inputVideoAbsPath, mattedVideoAbsPath);
      finalVideoUrl = `/pet-videos/${mattedFileName}`;
    } catch (mattingError) {
      console.error("Matting failed, falling back to original video:", mattingError);
    }

    tracker.setSucceeded(taskId, { videoUrl: finalVideoUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "动画生成失败";
    tracker.setFailed(taskId, message);
  } finally {
    clearInterval(tickInterval);
  }
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    body = null;
  }

  const prompt = buildIdlePrompt(
    body && typeof body === "object" && "prompt" in body ? String((body as { prompt?: unknown }).prompt || "") : "",
    body && typeof body === "object" && "style" in body ? String((body as { style?: unknown }).style || "") : ""
  );
  const imageUrl =
    body && typeof body === "object" && "imageUrl" in body ? String((body as { imageUrl?: unknown }).imageUrl || "") : "";
  const sourceImageUrl =
    body && typeof body === "object" && "sourceImageUrl" in body
      ? String((body as { sourceImageUrl?: unknown }).sourceImageUrl || "")
      : imageUrl;

  if (!imageUrl) {
    return NextResponse.json({ error: "缺少参考图 imageUrl" }, { status: 400 });
  }

  const availability = getAnimationProviderAvailability(process.env);
  const currentProvider = availability[ANIMATION_PROVIDER_ID];
  if (!currentProvider?.available) {
    return NextResponse.json(
      {
        error: `当前 AI 动画提供商未配置：请设置 ${currentProvider?.envKey || "DASHSCOPE_API_KEY"}`,
        provider: ANIMATION_PROVIDER_ID
      },
      { status: 400 }
    );
  }

  const wantLegacy =
    body && typeof body === "object" && "legacy" in body
      ? Boolean((body as { legacy?: unknown }).legacy)
      : false;

  // ------------------------------------------------------------------
  // Fast-path: return taskId immediately, run the job in the background,
  // and let the front-end poll /api/pet/animation-status?taskId=xxx for
  // real progress. This avoids the previous behaviour where the user had
  // to wait for the entire Wan run to finish before seeing any response
  // (often perceived as a hang).
  // ------------------------------------------------------------------
  if (!wantLegacy) {
    const taskId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tracker.setSubmitted(taskId);

    // Capture request.url for resolving relative imageUrl inside the
    // background job. We cannot await the body twice.
    const ctx = {
      prompt,
      imageUrl,
      sourceImageUrl,
      requestUrl: request.url
    };

    // Run job in the background. setImmediate detaches it from the current
    // request lifecycle so the response can return immediately.
    setImmediate(() => {
      runJobForTask(taskId, ctx).catch(() => {
        /* error is already recorded on the tracker */
      });
    });

    return NextResponse.json({
      ok: true,
      taskId,
      provider: ANIMATION_PROVIDER_ID,
      legacy: false
    });
  }

  // ------------------------------------------------------------------
  // Legacy synchronous path. Kept for backward compatibility with old
  // clients and tests that want a single round-trip.
  // ------------------------------------------------------------------
  try {
    const apiKey = String(process.env.DASHSCOPE_API_KEY || "");
    let finalSourceUrl = sourceImageUrl;
    if (finalSourceUrl.startsWith("/") || finalSourceUrl.includes("localhost")) {
      const { bytes, contentType } = await fetchImageBuffer(finalSourceUrl, request.url);
      finalSourceUrl = `data:${contentType};base64,${bytes.toString("base64")}`;
    }

    const upstreamUrl = await generateWithDashscope(
      apiKey,
      prompt,
      finalSourceUrl
    );
    let localVideoUrl = await saveVideoToPublic(upstreamUrl, "dashscope_wan");

    // Process Matting on the generated video
    try {
      const inputVideoAbsPath = path.join(process.cwd(), "public", localVideoUrl.replace(/^\//, ""));
      const mattedFileName = localVideoUrl.split("/").pop()!.replace(/\.[^.]+$/, "") + "-matted.webm";
      const mattedVideoAbsPath = path.join(process.cwd(), "public", "pet-videos", mattedFileName);

      await mattingVideo(inputVideoAbsPath, mattedVideoAbsPath);
      localVideoUrl = `/pet-videos/${mattedFileName}`;
    } catch (mattingError) {
      console.error("Matting failed, falling back to original video:", mattingError);
    }

    return NextResponse.json({
      ok: true,
      provider: ANIMATION_PROVIDER_ID,
      prompt,
      videoUrl: localVideoUrl
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "动画生成失败",
        provider: ANIMATION_PROVIDER_ID
      },
      { status: 500 }
    );
  }
}
