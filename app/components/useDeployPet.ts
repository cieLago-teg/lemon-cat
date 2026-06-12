"use client";

import { useEffect, useRef, useState } from "react";

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
};

const INITIAL: DeployProgress = { stage: "idle", percent: 0, message: "准备就绪", fraction: 0 };

export function useDeployPet() {
  const [progress, setProgress] = useState<DeployProgress>(INITIAL);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [usedCachedVideo, setUsedCachedVideo] = useState(false);
  const pollRef = useRef<{ timer: ReturnType<typeof setInterval> | null; taskId: string | null }>({
    timer: null,
    taskId: null
  });
  const abortedRef = useRef(false);

  // 组件卸载或中途取消时，停掉轮询
  useEffect(() => {
    return () => {
      abortedRef.current = true;
      if (pollRef.current.timer) {
        clearInterval(pollRef.current.timer);
        pollRef.current.timer = null;
      }
    };
  }, []);

  function setStage(stage: DeployStage, percent: number, message: string) {
    setProgress({ stage, percent, message, fraction: Math.max(0, Math.min(1, percent / 100)) });
  }

  async function pollUntilDone(taskId: string) {
    return new Promise<string>((resolve, reject) => {
      const tick = async () => {
        if (abortedRef.current) {
          if (pollRef.current.timer) clearInterval(pollRef.current.timer);
          pollRef.current.timer = null;
          return;
        }
        try {
          const res = await fetch(`/api/pet/animation-status?taskId=${taskId}`);
          const data = await res.json();
          const task = data?.task;
          if (task?.stage === "Success" && task?.videoUrl) {
            if (pollRef.current.timer) clearInterval(pollRef.current.timer);
            pollRef.current.timer = null;
            setStage("animating", 99, "正在合成最终视频…");
            resolve(String(task.videoUrl));
            return;
          }
          if (task?.stage === "Failure") {
            if (pollRef.current.timer) clearInterval(pollRef.current.timer);
            pollRef.current.timer = null;
            reject(new Error(task.message || task.error || "动画生成失败"));
            return;
          }
          if (typeof task?.percent === "number") {
            // 后端给的 percent 直接覆盖（来自 STAGE_PERCENTS + tickWithoutStatus）
            setStage(
              "animating",
              Math.max(progress.percent, Math.min(95, task.percent)),
              task.message || progress.message
            );
          } else if (task?.message) {
            setStage("animating", progress.percent, task.message);
          }
        } catch {
          // 网络波动：保持上一帧，不中断
        }
      };
      tick();
      pollRef.current.timer = setInterval(tick, 2500);
    });
  }

  async function deploy(opts: DeployOptions): Promise<DeployResult> {
    if (deploying) {
      return { ok: false, videoUrl: null, usedCachedVideo: Boolean(opts.videoUrl) };
    }
    setError("");
    setHint("");
    abortedRef.current = false;
    setDeploying(true);
    setStage("animating", 5, "已提交到 Wan 队列");

    try {
      let videoUrl = opts.videoUrl || null;
      const usedCachedVideo = Boolean(videoUrl);

      if (!videoUrl) {
        // 1. 提交动画任务
        setStage("animating", 8, "正在为它注入生命…");
        const submitRes = await fetch("/api/pet/animate", {
          method: "POST",
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
        pollRef.current.taskId = taskId;
        setStage("animating", 12, "已提交到 Wan 队列");

        // 2. 轮询等结果
        videoUrl = await pollUntilDone(taskId);
      }

      // 3. 投放视频
      setStage("deploying", 99, "正在把它送到桌面…");
      const deployRes = await fetch("/api/pet/set-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl })
      });
      const deployData = await deployRes.json().catch(() => ({}));
      if (!deployRes.ok) {
        throw new Error(deployData?.error || `投放失败 (${deployRes.status})`);
      }
      setUsedCachedVideo(usedCachedVideo);
      setStage("done", 100, "它已经出现在桌面啦");
      setHint(
        deployData?.shellLaunched
          ? "🛋️ 桌宠壳已响应"
          : "已写入形态（如未弹出窗口，请运行 npm run dev:pet-shell）"
      );
      return { ok: true, videoUrl, usedCachedVideo };
    } catch (e) {
      setError(e instanceof Error ? e.message : "召唤失败");
      setStage("error", 0, "召唤失败");
      return { ok: false, videoUrl: null, usedCachedVideo: Boolean(opts.videoUrl) };
    } finally {
      setDeploying(false);
    }
  }

  function reset() {
    setProgress(INITIAL);
    setError("");
    setHint("");
    setDeploying(false);
  }

  return { progress, error, hint, deploying, deploy, reset, usedCachedVideo };
}
