"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PetArchive } from "@/lib/db/archive-types";
import { useDeployPet } from "@/app/components/useDeployPet";
import { DeployProgressBar } from "@/app/components/DeployProgressBar";

// 2026-06-09 Step 6.2：诞生时刻成功页。
// 设计目标：杂志感 + 治愈系 + 仪式感。
// - 左页：宠物图（淡入 + 暖光）
// - 右页：档案卡（轻微上浮）
// - 底部柔光晕
// - 3 按钮：召唤到桌面（主）/ 查看档案 / 继续生成新形态

type ArchiveApiResp = { archive?: PetArchive; error?: string };

export default function CreateSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [archive, setArchive] = useState<PetArchive | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summoning, setSummoning] = useState(false);
  const [hint, setHint] = useState("");
  // 2026-06-12: 召唤到桌面只走视频，没有 videoUrl 就触发动画生成，全程显示真实进度。
  const { progress: deployProgress, error: deployError, hint: deployHint, deploy, usedCachedVideo } = useDeployPet();

  useEffect(() => {
    if (!id) {
      setError("缺少档案 id");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/archive/${id}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: ArchiveApiResp) => {
        if (!data?.archive) {
          setError(data?.error ?? "档案不存在");
        } else {
          setArchive(data.archive);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError("加载档案失败");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [id]);

  const currentMorph =
    archive?.results?.[Math.max(0, Math.min(archive.currentMorphIndex ?? 0, (archive.results ?? []).length - 1))];

  // Step 6.2：把 8 字段档案转成一句"特性描述"，显示在档案卡里
  const traitSentence = archive
    ? (() => {
        const traits: string[] = [];
        if (archive.species) traits.push(archive.species);
        if (archive.furColor) traits.push(archive.furColor);
        if (archive.eyeColor) traits.push(archive.eyeColor);
        if (archive.earShape) traits.push(archive.earShape);
        if (archive.bodyType) traits.push(archive.bodyType);
        if (archive.petVibe) traits.push(archive.petVibe);
        if (archive.customFeatures) traits.push(archive.customFeatures);
        return traits.join("、");
      })()
    : "";

  const handleSummon = async () => {
    if (!archive || !currentMorph) return;
    setSummoning(true);
    setHint("");
    try {
      const deployResult = await deploy({
        imageUrl: currentMorph.imageUrl,
        videoUrl: currentMorph.videoUrl || null,
        style: currentMorph.style
      });
      if (deployResult.ok) {
        if (deployResult.videoUrl && !currentMorph.videoUrl) {
          const persistVideo = await fetch(`/api/archive/${archive.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              morph: { style: currentMorph.style, action: "setVideo", videoUrl: deployResult.videoUrl }
            })
          });
          if (persistVideo.ok) {
            const persisted = await persistVideo.json();
            if (persisted?.archive) setArchive(persisted.archive);
          }
        }
        const now = Date.now();
        const patch = await fetch(`/api/archive/${archive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deployedAt: now, lastSummonedAt: now, currentMorphIndex: archive.currentMorphIndex ?? 0 })
        });
        if (patch.ok) {
          const pd = await patch.json();
          if (pd?.archive) setArchive(pd.archive);
        }
        setHint(deployHint || "已写入形态（如未弹出窗口，请运行 npm run dev:pet-shell）");
      } else if (deployError) {
        setHint(`❌ ${deployError}`);
      }
    } catch (e) {
      setHint(e instanceof Error ? `❌ ${e.message}` : "召唤失败");
    } finally {
      setSummoning(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-amber-50/40 text-amber-700">
        <p>正在读取档案...</p>
      </div>
    );
  }
  if (error || !archive) {
    return (
      <div className="grid min-h-screen place-items-center bg-amber-50/40">
        <div className="rounded-3xl border border-rose-200 bg-white/90 p-8 text-center shadow">
          <p className="text-rose-700">{error || "档案不存在"}</p>
          <Link
            href="/pets"
            className="mt-4 inline-block rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-800"
          >
            返回档案库
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/40">
      {/* 仪式感动效：暖光晕 + 卡片淡入 */}
      <SuccessCSS />

      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-10">
        <p className="success-rise text-sm font-medium text-amber-600">🐾 它的数字形态已生成</p>
        <h1 className="success-rise mt-2 text-4xl font-semibold text-amber-900" style={{ animationDelay: "0.1s" }}>
          诞生时刻
        </h1>
        <p className="success-rise mt-1 text-base text-amber-700" style={{ animationDelay: "0.2s" }}>
          一只<span className="mx-1 font-semibold text-amber-900">{archive.petName}</span>，从照片里走出来了。
        </p>

        {/* 杂志感双栏 */}
        <div className="mt-8 grid w-full grid-cols-1 gap-5 md:grid-cols-[1.1fr_1fr]">
          {/* 左页：宠物图（淡入 + 暖光） */}
          <div
            className="success-fade relative overflow-hidden rounded-3xl border border-amber-200 bg-white/80 shadow-2xl"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="success-glow pointer-events-none absolute inset-0" aria-hidden />
            {currentMorph ? (
              <img
                src={currentMorph.imageUrl}
                alt={archive.petName}
                className="relative h-80 w-full object-contain"
              />
            ) : (
              <div className="grid h-80 place-items-center text-amber-400">🐾 暂无形态</div>
            )}
            <div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-amber-800 shadow">
              {currentMorph?.style ?? "默认形态"} · {archive.petName}
            </div>
          </div>

          {/* 右页：档案卡（轻微上浮） */}
          <div
            className="success-fade rounded-3xl border border-amber-200 bg-white/90 p-6 shadow-xl"
            style={{ animationDelay: "0.5s" }}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500">数字档案</p>
                <h2 className="mt-1 text-2xl font-semibold text-amber-900">{archive.petName}</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                ✓ 已就绪
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-amber-800">
              {archive.petName}，{traitSentence || "一只温暖的小家伙"}。
            </p>

            {/* 8 字段 chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                archive.species,
                archive.furColor,
                archive.eyeColor,
                archive.earShape,
                archive.bodyType,
                archive.petVibe
              ]
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800"
                  >
                    {t}
                  </span>
                ))}
            </div>

            <dl className="mt-5 space-y-2 border-t border-amber-100 pt-4 text-xs text-amber-700">
              <div className="flex items-baseline justify-between">
                <dt>数字编号</dt>
                <dd className="font-mono text-amber-900">PET-{archive.id.slice(0, 8).toUpperCase()}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>创建时间</dt>
                <dd className="text-amber-900">
                  {new Date(archive.createdAt).toLocaleString("zh-CN", { hour12: false })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt>形态数量</dt>
                <dd className="text-amber-900">{(archive.results ?? []).length} 张</dd>
              </div>
            </dl>

            {hint && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {hint}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleSummon}
                disabled={summoning || !currentMorph}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-700 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-sm transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {summoning ? "召唤中..." : "🛋️ 召唤到桌面（动态）"}
              </button>
              {/* 真实进度条 */}
              <div className="basis-full">
                <DeployProgressBar progress={deployProgress} usedCached={usedCachedVideo} />
              </div>
              <button
                type="button"
                onClick={() => router.push(`/pets/${archive.id}`)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-sm transition-colors hover:bg-amber-50"
              >
                📁 查看档案
              </button>
              <Link
                href="/create"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                ✨ 继续生成新形态
              </Link>
            </div>
          </div>
        </div>

        <p className="success-fade mt-8 text-xs text-amber-600" style={{ animationDelay: "0.7s" }}>
          后续可以在「桌面陪伴」里为它选择陪伴模式 🛋️
        </p>
      </main>
    </div>
  );
}

// 杂志感动效：暖光晕 + 卡片淡入 + 文字上浮
function SuccessCSS() {
  return (
    <style jsx global>{`
      @keyframes success-fade-in {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes success-rise-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes success-glow-pulse {
        0%   { opacity: 0.55; transform: scale(1.0); }
        50%  { opacity: 0.85; transform: scale(1.05); }
        100% { opacity: 0.55; transform: scale(1.0); }
      }
      .success-fade { animation: success-fade-in 0.7s ease-out both; }
      .success-rise { animation: success-rise-in 0.5s ease-out both; }
      .success-glow {
        background: radial-gradient(ellipse 60% 50% at 50% 35%, rgba(254, 243, 199, 0.85) 0%, rgba(253, 230, 138, 0.4) 50%, transparent 80%);
        animation: success-glow-pulse 4s ease-in-out infinite;
      }
    `}</style>
  );
}
