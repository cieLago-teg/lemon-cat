"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PetArchive } from "@/lib/db/archive";
import { useDeployPet } from "@/app/components/useDeployPet";
import { DeployProgressBar } from "@/app/components/DeployProgressBar";

// 2026-06-09 商业化减法 + 绘本风：5 个状态 + 1 个"全部"
type ArchiveStatus = "all" | "ready" | "needs_fix" | "error" | "deployed" | "fav";

// 状态 → 绘本风胶囊
type StatusBadge = { label: string; emoji: string; dot: string; bg: string; text: string };

// 2026-06-09 绘本风：状态映射
function deriveStatus(a: PetArchive): ArchiveStatus {
  if (a.hasFav) return "fav";
  if (a.needsFix) return "needs_fix";
  if (a.deployedAt > 0) return "deployed";
  if ((a.results ?? []).length > 0) return "ready";
  return "error";
}

// 状态 → 用户视角的徽章
function badgeOf(a: PetArchive): StatusBadge {
  if (a.hasFav) return { label: "最喜欢", emoji: "💗", dot: "bg-rose-400", bg: "bg-rose-100/80", text: "text-rose-600" };
  if (a.needsFix) return { label: "待调整", emoji: "🍂", dot: "bg-amber-400", bg: "bg-amber-100/80", text: "text-amber-700" };
  if (a.deployedAt > 0) return { label: "活跃中", emoji: "🌿", dot: "bg-emerald-500", bg: "bg-emerald-100/80", text: "text-emerald-700" };
  if ((a.results ?? []).length > 0) return { label: "已就绪", emoji: "✨", dot: "bg-amber-500", bg: "bg-amber-100/80", text: "text-amber-700" };
  return { label: "休息中", emoji: "💤", dot: "bg-stone-400", bg: "bg-stone-100/80", text: "text-stone-600" };
}

// 2026-06-09 绘本风：每只卡片使用不同画布主题（基于 id 哈希），让列表视觉变化丰富
type Canvas = "watercolor" | "pink" | "green" | "sky";
const CANVAS: Canvas[] = ["watercolor", "pink", "green", "sky"];
function pickCanvas(id: string): Canvas {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return CANVAS[Math.abs(h) % CANVAS.length];
}
const CANVAS_BG: Record<Canvas, string> = {
  watercolor: "bg-canvas-watercolor",
  pink: "bg-canvas-pink",
  green: "bg-canvas-green",
  sky: "bg-canvas-sky"
};

export default function ArchivePage() {
  const [archives, setArchives] = useState<PetArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<ArchiveStatus>("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/archive", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.archives) {
          setArchives(data.archives);
          setLikedIds(new Set((data.archives as PetArchive[]).filter((a) => a.hasFav).map((a) => a.id)));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Failed to load archives", err);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // 真实数据统计（继承 hard rule：0 假数）
  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();

    let interactionTotal = 0;
    let interactionToday = 0;
    let summoned = 0;
    for (const a of archives) {
      interactionTotal += a.interactionTotal ?? 0;
      interactionToday += a.interactionToday ?? 0;
      if (a.deployedAt > 0) summoned++;

      const todayFromSummon =
        (a.interactionToday === 0 || a.interactionToday === undefined) &&
        a.lastSummonedAt >= startTs;
      if (todayFromSummon) interactionToday += 1;
    }
    return {
      total: archives.length,
      interactionTotal,
      interactionToday,
      summoned
    };
  }, [archives]);

  const statusCounts = useMemo(() => {
    const counts: Record<ArchiveStatus, number> = {
      all: archives.length,
      ready: 0,
      needs_fix: 0,
      error: 0,
      deployed: 0,
      fav: 0
    };
    for (const a of archives) counts[deriveStatus(a)]++;
    return counts;
  }, [archives]);

  const filtered = useMemo(() => {
    if (activeStatus === "all") return archives;
    return archives.filter((a) => deriveStatus(a) === activeStatus);
  }, [archives, activeStatus]);

  const toggleLike = async (a: PetArchive) => {
    const wasFav = a.hasFav;
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(a.id);
      else next.add(a.id);
      return next;
    });
    setArchives((prev) => prev.map((x) => (x.id === a.id ? { ...x, hasFav: !wasFav } : x)));
    try {
      const res = await fetch(`/api/archive/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasFav: !wasFav })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.archive) {
          setArchives((prev) => prev.map((x) => (x.id === a.id ? data.archive : x)));
        }
      }
    } catch (e) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(a.id);
        else next.delete(a.id);
        return next;
      });
      setArchives((prev) => prev.map((x) => (x.id === a.id ? { ...x, hasFav: wasFav } : x)));
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* 背景图：fixed 铺满整个视口（含 AppNav 位置），z-index 在所有内容之下 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-wallpaper-archive bg-wallpaper-cover"
      />
      {/* 半透明白底渐变：从顶部透明渐变到中下 88% 不透明，让背景图顶部留白区完全透出 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, rgba(255,251,240,0) 0%, rgba(255,251,240,0) 35%, rgba(255,251,240,0.45) 50%, rgba(255,251,240,0.78) 65%, rgba(255,251,240,0.92) 100%)"
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8">
        {/* 顶部留白：首屏内容上提，浏览器打开即能看到基础内容 */}
        {/* 桌面端 ≥1024px 留 210px / 平板 170px / 手机 130px */}
        <div
          aria-hidden
          className="h-[130px] sm:h-[170px] lg:h-[210px]"
        />

        {/* 标题区：大号手写体「我的宠物」+ 花藤 + 右上创建按钮 */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col">
            <div className="relative inline-block">
              <h1 className="font-handwriting text-5xl text-[#5c2e10] sm:text-6xl lg:text-7xl leading-none drop-shadow-sm">
                我的宠物
              </h1>
              <svg
                aria-hidden
                className="absolute -bottom-5 left-2 h-6 w-32 text-emerald-700/70"
                viewBox="0 0 120 24"
                fill="none"
              >
                <path
                  d="M2 14 Q 18 4, 36 12 T 70 10 T 104 14 T 118 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="22" cy="8" r="2" fill="currentColor" opacity="0.7" />
                <circle cx="58" cy="8" r="2" fill="currentColor" opacity="0.7" />
                <circle cx="92" cy="9" r="2" fill="currentColor" opacity="0.7" />
              </svg>
            </div>
            <p className="mt-6 ml-1 text-sm text-[#5c2e10]/75">
              你所有毛孩子的数字档案都在这里
            </p>
          </div>
        </header>

        {/* 三宫格统计胶囊：使用半透明白底 + backdrop-blur */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCapsule
            emoji="🐾"
            label="总宠物"
            value={stats.total}
            unit="只"
            accent="bg-[#f8c4a0]/55"
            ring="ring-[#f8c4a0]/60"
            text="text-[#5c2e10]"
          />
          <StatCapsule
            emoji="💗"
            label="互动总数"
            value={stats.interactionTotal}
            unit="次"
            accent="bg-[#f8a8a8]/50"
            ring="ring-[#f8a8a8]/60"
            text="text-[#5c2e10]"
          />
          <StatCapsule
            emoji="🛋️"
            label="已召唤"
            value={stats.summoned}
            unit="次"
            accent="bg-[#a8e6b8]/55"
            ring="ring-[#a8e6b8]/60"
            text="text-[#5c2e10]"
          />
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-[#5c2e10]/70 bg-paper-glass rounded-3xl">
            正在读取档案...
          </div>
        ) : archives.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 pb-16 lg:grid-cols-[160px_1fr]">
            <FilterRail
              active={activeStatus}
              onChange={setActiveStatus}
              counts={statusCounts}
            />

            <div>
              {filtered.length === 0 ? (
                <div className="py-16 text-center bg-paper-glass rounded-3xl">
                  <div className="text-3xl mb-3" aria-hidden>
                    🫥
                  </div>
                  <p className="text-sm text-[#5c2e10]/70">这个分类下还没有宠物</p>
                  <button
                    onClick={() => setActiveStatus("all")}
                    className="mt-4 text-xs text-[#5c2e10] underline-offset-2 hover:underline"
                  >
                    看看全部 {archives.length} 只
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((a) => (
                    <PetCard
                      key={a.id}
                      archive={a}
                      canvas={pickCanvas(a.id)}
                      liked={likedIds.has(a.id) || a.hasFav}
                      onToggleLike={() => toggleLike(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 统计胶囊（三宫格）：半透明白底
// =============================================================================
function StatCapsule({
  emoji,
  label,
  value,
  unit,
  accent,
  ring,
  text
}: {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  accent: string;
  ring: string;
  text: string;
}) {
  return (
    <div className={`group relative flex items-center gap-3 rounded-[28px] bg-paper-glass px-5 py-4 ring-1 ${ring} shadow-sm`}>
      <div className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${accent}`} aria-hidden>
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-[#5c2e10]/75">{label}</div>
        <div className={`num-art flex items-baseline gap-1 ${text}`}>
          <span className="text-3xl">{value.toLocaleString()}</span>
          <span className="text-sm font-normal text-[#5c2e10]/60">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 左侧筛选栏：半透明白底
// =============================================================================
function FilterRail({
  active,
  onChange,
  counts
}: {
  active: ArchiveStatus;
  onChange: (s: ArchiveStatus) => void;
  counts: Record<ArchiveStatus, number>;
}) {
  const items: { key: ArchiveStatus; label: string; emoji: string; theme: { active: string; idle: string } }[] = [
    {
      key: "all",
      label: "全部",
      emoji: "🐾",
      theme: {
        active: "bg-[#f8c4a0]/75 ring-2 ring-[#e89060] text-[#5c2e10]",
        idle: "bg-paper-glass text-[#5c2e10]/80 hover:bg-paper-glass-strong"
      }
    },
    {
      key: "deployed",
      label: "活跃的",
      emoji: "🌿",
      theme: {
        active: "bg-[#bbf7d0]/85 ring-2 ring-emerald-500 text-[#14532d]",
        idle: "bg-paper-glass text-[#5c2e10]/80 hover:bg-paper-glass-strong"
      }
    },
    {
      key: "fav",
      label: "最喜欢",
      emoji: "💗",
      theme: {
        active: "bg-[#fecaca]/85 ring-2 ring-rose-400 text-[#7c1d3a]",
        idle: "bg-paper-glass text-[#5c2e10]/80 hover:bg-paper-glass-strong"
      }
    }
  ];
  return (
    <aside className="flex flex-row gap-2 lg:flex-col lg:gap-2.5">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`group flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left text-sm transition-all lg:flex-none lg:py-3.5 ${
              isActive ? it.theme.active : it.theme.idle
            }`}
          >
            <span aria-hidden className="text-lg">{it.emoji}</span>
            <span className="font-semibold">{it.label}</span>
            <span className={`ml-auto text-xs ${isActive ? "opacity-80" : "text-[#5c2e10]/55"}`}>
              {counts[it.key]}
            </span>
          </button>
        );
      })}
    </aside>
  );
}

// =============================================================================
// 宠物卡片：半透明白底 + 水彩画布
// =============================================================================
function PetCard({
  archive,
  canvas,
  liked,
  onToggleLike
}: {
  archive: PetArchive;
  canvas: Canvas;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const firstResult = (archive.results ?? [])[Math.max(0, Math.min(archive.currentMorphIndex ?? 0, (archive.results ?? []).length - 1))];
  const hasMorph = Boolean(firstResult);
  const imageSrc = hasMorph ? firstResult.imageUrl : archive.sourceImage ? `/api/archive/image/${archive.id}` : null;
  const matteSrc = useMemo(() => {
    if (!imageSrc || !hasMorph) return null;
    return imageSrc.replace(/\/api\/archive\/image\//, "/api/archive/matte-image/");
  }, [imageSrc, hasMorph]);

  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  // 2026-06-12: 召唤到桌面只走视频，没有 videoUrl 就触发动画生成，全程显示真实进度。
  const { progress: deployProgress, error: deployError, deploy, usedCachedVideo } = useDeployPet();
  const handleDeploy = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!hasMorph || !firstResult) return;
    setDeploying(true);
    try {
      const deployResult = await deploy({
        imageUrl: firstResult.imageUrl,
        videoUrl: firstResult.videoUrl || null,
        style: firstResult.style
      });
      if (deployResult.ok) {
        const now = Date.now();
        await fetch(`/api/archive/${archive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deployedAt: now, lastSummonedAt: now, currentMorphIndex: archive.currentMorphIndex ?? 0 })
        });
        if (deployResult.videoUrl && !firstResult.videoUrl) {
          await fetch(`/api/archive/${archive.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              morph: { style: firstResult.style, action: "setVideo", videoUrl: deployResult.videoUrl }
            })
          });
        }
        setDeployed(true);
        setTimeout(() => setDeployed(false), 2200);
      } else if (deployError) {
        alert(deployError);
      }
    } catch (err) {
      console.error("Deploy failed", err);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <article className="group relative -translate-y-0 transition-transform duration-300 hover:-translate-y-1.5">
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[28px] bg-white/30 backdrop-blur-xl paint-border">
        {/* 同图模糊铺底：自动匹配宠物图片主色调 */}
        {imageSrc && (
          <img
            src={imageSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-[1.25]"
          />
        )}
        {/* 极淡纸感遮罩：不洗掉宠物固有色调 */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(255,255,255,0.22),transparent_55%),linear-gradient(180deg,rgba(255,251,240,0.08),rgba(255,251,240,0.18))]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-paper-noise opacity-25" aria-hidden />

        {/* 宠物图（抠像透明背景版，无抠图时回退原图） */}
        {(matteSrc || imageSrc) ? (
          <img
            src={matteSrc || imageSrc!}
            alt={archive.petName}
            className="absolute inset-0 h-full w-full object-contain p-3 pb-14 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center pb-14 text-6xl text-[#5c2e10]/30">
            🐾
          </div>
        )}

        {/* 底部信息条：名字在左 / 按钮在右，同一条磨砂玻璃 */}
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-white/55 px-3.5 py-2 backdrop-blur-md ring-1 ring-white/60">
          <div className="flex items-center justify-between">
            <h2 className="font-handwriting text-xl text-[#5c2e10] truncate pr-2">
              {archive.petName}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onToggleLike}
                className={
                  "grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-rose-100/75 " +
                  (liked ? "text-rose-500" : "text-[#5c2e10]/50 hover:text-rose-500")
                }
                aria-label="点赞"
                title="点赞"
              >
                <span aria-hidden className="text-base">{liked ? "💗" : "❤️"}</span>
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={!hasMorph || deploying}
                className="grid h-9 w-9 place-items-center rounded-full text-[#5c2e10]/50 transition-colors hover:bg-emerald-100/75 hover:text-emerald-700 disabled:opacity-30"
                aria-label="召唤到桌面"
                title={deployed ? "已召唤到桌面 ✓" : "召唤到桌面"}
              >
                <span aria-hidden className="text-base">🪄</span>
              </button>
            </div>
          </div>
          {/* 召唤进度：显示在卡片信息条下方，渐隐 */}
          <div className="mt-1.5">
            <DeployProgressBar progress={deployProgress} usedCached={usedCachedVideo} />
            {deployed && (
              <p className="text-[10px] text-emerald-700">✓ 已召唤到桌面（如未弹出，请运行 npm run dev:pet-shell）</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// =============================================================================
// 温柔空状态
// =============================================================================
function EmptyState() {
  return (
    <div className="bg-paper-glass rounded-3xl py-20 text-center">
      <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-[#f8c4a0]/55 text-5xl">
        🐾
      </div>
      <h3 className="font-handwriting text-3xl text-[#5c2e10]">这里还很安静</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm text-[#5c2e10]/75">
        上传一张照片，开始建立第一只数字宠物，让它的灵魂永远陪着你。
      </p>
      <Link
        href="/create"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#e87a7a] px-6 py-2.5 text-sm font-bold text-white shadow-[0_6px_18px_-6px_rgba(232,122,122,0.7)] hover:bg-[#d86565]"
      >
        <span aria-hidden>✨</span>
        创建新的数字宠物
      </Link>
    </div>
  );
}
