"use client";

import { useEffect, useRef, useState } from "react";
import { pollAnimation } from "@/lib/pet/poll-animation.js";
import { apiFetch } from "@/app/components/useSession";

/**
 * 统一的"召唤到桌面"hook：永远只走视频。
 * - 有 videoUrl → 直接调 /api/pet/set-video；
 * - 没有 videoUrl → 触发动画生成（/api/pet/animate）→ 轮询 /api/pet/animation-status
 *   → 拿到 videoUrl → /api/pet/set-video；
 * - 等待阶段持续返回 stage / percent / message，前端用 DeployProgress 渲染。
 */

export type DeployStage =
  | "idle"
  | "animating"
  | "deploying"
  | "done"
  | "error";

export type DeployProgress = {
  stage: DeployStage;
  percent: number;
  message: string;
  // 0~1 之间的小数。percent 0 表示开始，1 表示完成；前端 UI 直接用 percent * 100。
  fraction: number;
};

export type DeployOptions = {
  imageUrl: string;
  // 已有视频时可省略动画步骤
  videoUrl?: string | null;
  // 2026-07-15 Step 6.2：可选手绘 8 方向视频播放列表（m3u8/外部视频源），
  // 由 /create/success 页面传入，Electron 桌宠按方向切换播放。允许 null。
  videoPlaylist?: string | string[] | null;
  // 2026-07-15 Step 6.2：被部署的档案 id（Electron 桌宠 config 写入用）。允许 undefined。
  archiveId?: string;
  // 2026-07-15 Step 6.2：召唤模式（"playlist" = 用预生成视频列表；其他 = 走 i2v 生成）。
  mode?: string;
  // 可选：自定义 prompt 注入（一般不用，server 会按 style 自动拼）
  style?: string;
};

export type DeployResult = {
  ok: boolean;
  videoUrl: string | null;
  usedCachedVideo: boolean;
};

export type DeployState = {
  progress: DeployProgress;
  error: string;
  // 召唤成功 / 失败后给一个轻提示
  hint: string;
  // 内部用：上一次触发的 taskId，供 cleanup
  pollRef: { timer: ReturnType<typeof setInterval> | null; taskId: string | null };
  // 召唤中（点击召唤按钮后到结束期间）
  deploying: boolean;
  // 2026-07-15 Step 6.2：Railway 部署环境下，set-video 返回的浏览器内播放 URL。
  // 公网用户召唤成功后，前端用此 URL 渲染 <video autoPlay loop> 给评审看。
  // 本机 dev 环境为 null（桌宠直接出现在本地桌面）。
  playbackUrl: string | null;
};

const INITIAL: DeployProgress = { stage: "idle", percent: 0, message: "准备就绪", fraction: 0 };

export function useDeployPet() {
  const [progress, setProgress] = useState<DeployProgress>(INITIAL);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [usedCachedVideo, setUsedCachedVideo] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const operationRef = useRef<AbortController | null>(null);

  // 组件卸载或中途取消时，停掉轮询
  useEffect(() => {
    return () => {
      operationRef.current?.abort();
    };
  }, []);

  function setStage(stage: DeployStage, percent: number, message: string) {
    setProgress({ stage, percent, message, fraction: Math.max(0, Math.min(1, percent / 100)) });
  }

  async function deploy(opts: DeployOptions): Promise<DeployResult> {
    if (operationRef.current) {
      return { ok: false, videoUrl: null, usedCachedVideo: Boolean(opts.videoUrl) };
    }
    setError("");
    setHint("");
    setPlaybackUrl(null);
    const operation = new AbortController();
    operationRef.current = operation;
    setDeploying(true);
    setStage("animating", 5, "已提交到 Wan 队列");

    try {
      let videoUrl = opts.videoUrl || null;
      const usedCachedVideo = Boolean(videoUrl);

      if (!videoUrl) {
        // 1. 提交动画任务
        setStage("animating", 8, "正在为它注入生命…");
        const submitRes = await apiFetch("/api/pet/animate", {
          method: "POST",
          signal: operation.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: opts.imageUrl,
            style: opts.style || ""
          })
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok || !submitData?.taskId) {
          throw new Error(submitData?.error || `动画提交失败 (${submitRes.status})`);
        }
        const taskId: string = submitData.taskId;
        setStage("animating", 12, "已提交到 Wan 队列");

        // 2. 轮询等结果
        videoUrl = await pollAnimation(taskId, {
          fetch: apiFetch,
          signal: operation.signal,
          onProgress: (task) => setProgress((previous) => {
            const percent = Math.max(previous.percent, Math.min(95, task.percent ?? previous.percent));
            return { stage: "animating", percent, fraction: percent / 100, message: task.message || previous.message };
          })
        });
      }

      // 3. 投放视频
      setStage("deploying", 99, "正在把它送到桌面…");
      const deployRes = await apiFetch("/api/pet/set-video", {
        method: "POST",
        signal: operation.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl })
      });
      const deployData = await deployRes.json().catch(() => ({}));
      if (!deployRes.ok) {
        throw new Error(deployData?.error || `投放失败 (${deployRes.status})`);
      }
      setUsedCachedVideo(usedCachedVideo);
      // 2026-07-15 Step 6.2：Railway 部署环境下 set-video 返回 playbackUrl，
      // 前端拿到后用 <video> 标签循环播放。本机 dev 环境为 null（Electron 已起）。
      if (deployData?.playbackUrl) {
        setPlaybackUrl(String(deployData.playbackUrl));
      }
      setStage("done", 100, deployData?.playbackUrl ? "视频已就绪，可在网页预览" : deployData?.shellLaunched ? "已请求打开桌宠窗口" : "视频已保存，桌宠窗口尚未启动");
      setHint(
        deployData?.shellLaunched
          ? "🛋️ 桌宠壳已响应"
          : deployData?.playbackUrl
            ? "🎬 视频已就绪，正在循环播放"
            : "已写入形态（如未弹出窗口，请运行 npm run dev:pet-shell）"
      );
      return { ok: true, videoUrl, usedCachedVideo };
    } catch (e) {
      if (!operation.signal.aborted) {
        setError(e instanceof Error ? e.message : "召唤失败");
        setStage("error", 0, "召唤失败");
      }
      return { ok: false, videoUrl: null, usedCachedVideo: Boolean(opts.videoUrl) };
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        if (!operation.signal.aborted) setDeploying(false);
      }
    }
  }

  function reset() {
    operationRef.current?.abort();
    operationRef.current = null;
    setProgress(INITIAL);
    setError("");
    setHint("");
    setDeploying(false);
    setPlaybackUrl(null);
  }

  return { progress, error, hint, deploying, deploy, reset, usedCachedVideo, playbackUrl };
}
