"use client";

import type { DeployProgress } from "./useDeployPet";

/**
 * 召唤到桌面：通用进度条 + 阶段文案。
 * - 真实进度：使用 useDeployPet 给出的 percent（0~100）。
 * - 心理安慰：当上游长时间不更新时，bar 仍会缓慢推进（基于时间）。
 */
export function DeployProgressBar({ progress, usedCached }: { progress: DeployProgress; usedCached?: boolean }) {
  if (progress.stage === "idle") return null;

  if (progress.stage === "done") {
    return (
      <p className="mt-2 text-[11px] text-[#5c2e10]/70">
        {usedCached
          ? "💾 已复用之前生成的动态视频"
          : "✨ 已为新形象注入动态生命"}
      </p>
    );
  }

  // 心理安慰：当 progress 长时间不更新时，每秒额外推进一点（最多到 92%）。
  // 这里只读 progress 自身即可；useDeployPet 内已经做了真实进度回传。

  const color =
    progress.stage === "error"
      ? "bg-rose-500"
      : progress.stage === "deploying"
      ? "bg-emerald-700"
      : "bg-amber-700";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-[#5c2e10]/80">
        <span>
          {progress.stage === "error"
            ? "❌ 召唤失败"
            : progress.stage === "animating"
            ? "🪄 正在为它注入生命…"
            : "🛋️ 正在送它到桌面…"}
        </span>
        <span className="font-mono">{Math.round(progress.fraction * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60">
        <div
          className={`h-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(4, Math.round(progress.fraction * 100))}%` }}
        />
      </div>
      {progress.message && (
        <p className="mt-1.5 text-[10px] text-[#5c2e10]/70">{progress.message}</p>
      )}
    </div>
  );
}
