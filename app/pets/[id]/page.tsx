"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PetArchive } from "@/lib/db/archive";
import { useDeployPet } from "@/app/components/useDeployPet";
import { DeployProgressBar } from "@/app/components/DeployProgressBar";

// 2026-06-09 商业化减法：形态英文 style → 中文友好标签 + emoji
const STYLE_LABEL: Record<string, { label: string; emoji: string }> = {
  watercolor: { label: "水彩形态", emoji: "🎨" },
  lineart: { label: "线稿形态", emoji: "✏️" },
  desktop: { label: "桌宠形态", emoji: "🛋️" },
  dream: { label: "梦境形态", emoji: "💭" },
  pixel: { label: "像素形态", emoji: "🟦" },
  sketch: { label: "铅笔速写", emoji: "✏️" }
};
function getStyleLabel(style: string, index: number) {
  if (STYLE_LABEL[style]) return STYLE_LABEL[style];
  return { label: `形态 ${index + 1}`, emoji: "✨" };
}

// 8 个反馈标签
const FEEDBACK_TAGS = ["眼睛", "毛色", "耳朵", "脸型", "体型", "花纹", "神态", "其他"] as const;
type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export default function PetDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [archive, setArchive] = useState<PetArchive | null>(null);
  const [loading, setLoading] = useState(true);

  // 草稿
  const [draft, setDraft] = useState<PetArchive | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveHint, setSaveHint] = useState("");

  // 反馈弹窗
  const [feedbackTarget, setFeedbackTarget] = useState<{ style: string; tags: string[]; note: string } | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);

  // 召唤状态
  const [deploying, setDeploying] = useState(false);
  // 2026-06-12: 召唤到桌面只走视频，没有 videoUrl 就触发动画生成，全程显示真实进度。
  const { progress: deployProgress, error: deployError, deploy, usedCachedVideo } = useDeployPet();
  // 主视觉切换：原图 / 当前数字形象
  const [heroMode, setHeroMode] = useState<"morph" | "source">("morph");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch("/api/archive", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.archives) {
          const found = (data.archives as PetArchive[]).find((a) => a.id === id);
          setArchive(found || null);
          setDraft(found || null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error(err);
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const currentMorph = useMemo(() => {
    if (!archive) return null;
    const list = archive.results ?? [];
    if (list.length === 0) return null;
    const idx = Math.max(0, Math.min(archive.currentMorphIndex ?? 0, list.length - 1));
    return list[idx];
  }, [archive]);

  // 召唤到桌面（永远只走视频，没有 videoUrl 就自动触发动画生成）
  const handleDeploy = async () => {
    if (!archive || !currentMorph) return;
    setDeploying(true);
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
            if (persisted?.archive) {
              applyServerUpdate(persisted.archive);
            }
          }
        }
        const now = Date.now();
        const patch = await fetch(`/api/archive/${archive.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deployedAt: now, lastSummonedAt: now, currentMorphIndex: archive.currentMorphIndex ?? 0 })
        });
        if (patch.ok) {
          const data = await patch.json();
          applyServerUpdate(data.archive);
        }
      } else if (deployError) {
        alert(deployError);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "召唤失败");
    } finally {
      setDeploying(false);
    }
  };

  // 标记需要修正
  const toggleNeedsFix = async () => {
    if (!archive) return;
    const res = await fetch(`/api/archive/${archive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ needsFix: !archive.needsFix })
    });
    if (res.ok) {
      const data = await res.json();
      applyServerUpdate(data.archive);
    }
  };

  // 保存身份档案
  const saveProfile = async () => {
    if (!archive || !draft) return;
    setSavingProfile(true);
    setSaveHint("");
    try {
      const res = await fetch(`/api/archive/${archive.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petName: draft.petName,
          petVibe: draft.petVibe,
          customFeatures: draft.customFeatures,
          species: draft.species,
          furColor: draft.furColor,
          eyeColor: draft.eyeColor,
          earShape: draft.earShape,
          bodyType: draft.bodyType
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "保存失败");
      }
      const data = await res.json();
      applyServerUpdate(data.archive);
      setSaveHint("已保存");
      setTimeout(() => setSaveHint(""), 2000);
    } catch (e) {
      setSaveHint("保存失败");
    } finally {
      setSavingProfile(false);
    }
  };

  // 设为当前形态
  const setCurrentMorph = async (style: string) => {
    if (!archive) return;
    const res = await fetch(`/api/archive/${archive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ morph: { style, action: "setCurrent" } })
    });
    if (res.ok) {
      const data = await res.json();
      applyServerUpdate(data.archive);
    }
  };

  // 删除形态
  const deleteMorph = async (style: string) => {
    if (!archive) return;
    if (!confirm("确认删除这张形象吗？")) return;
    const res = await fetch(`/api/archive/${archive.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ morph: { style, action: "delete" } })
    });
    if (res.ok) {
      const data = await res.json();
      applyServerUpdate(data.archive);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data?.error ?? "删除失败");
    }
  };

  // 反馈
  const openFeedback = (style: string) => {
    if (!archive) return;
    const existing = archive.results.find((r) => r.style === style)?.feedback;
    setFeedbackTarget({
      style,
      tags: existing?.tags ?? [],
      note: existing?.note ?? ""
    });
  };

  const submitFeedback = async () => {
    if (!archive || !feedbackTarget) return;
    setSavingFeedback(true);
    try {
      const res = await fetch(`/api/archive/${archive.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morph: {
            style: feedbackTarget.style,
            action: "feedback",
            feedback: { tags: feedbackTarget.tags, note: feedbackTarget.note }
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        applyServerUpdate(data.archive);
        setFeedbackTarget(null);
      }
    } finally {
      setSavingFeedback(false);
    }
  };

  // 删除整个档案
  const handleDelete = async () => {
    if (!archive) return;
    if (!confirm(`确认删除「${archive.petName}」的档案吗？此操作不可恢复。`)) return;
    const res = await fetch(`/api/archive/${archive.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/pets");
    } else {
      alert("删除失败");
    }
  };

  function applyServerUpdate(updated: PetArchive) {
    setArchive(updated);
    setDraft((d) => (d && d.id === updated.id ? updated : d));
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-amber-700">
        正在读取档案...
      </div>
    );
  }
  if (!archive || !draft) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <div className="text-4xl mb-3" aria-hidden>
            🫥
          </div>
          <p className="text-amber-800 mb-4">找不到这只宠物...</p>
          <Link
            href="/pets"
            className="inline-flex rounded-full bg-amber-900 px-5 py-2 text-sm font-medium text-amber-50 hover:bg-amber-950"
          >
            ← 返回我的宠物
          </Link>
        </div>
      </div>
    );
  }

  const results = archive.results ?? [];
  const hasResults = results.length > 0;

  return (
    <div className="min-h-screen bg-amber-50/40 py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* 顶部极简：返回 + 名字（无卡片，无边框） */}
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex items-baseline gap-3">
            <Link
              href="/pets"
              className="text-sm text-amber-700/80 transition-colors hover:text-amber-900"
            >
              ← 我的宠物
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-amber-900">
              {archive.petName}
            </h1>
          </div>
          <p className="text-xs text-amber-600/70">
            创建于 {new Date(archive.createdAt).toLocaleDateString()}
          </p>
        </header>

        {/* 三栏布局：左档案 / 中大图 / 右召唤（描边更少） */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[1fr_1.3fr_1fr]">
          {/* 左：身份档案（底线式输入，无卡片框） */}
          <LeftProfilePanel
            archive={archive}
            draft={draft}
            setDraft={setDraft}
            saveHint={saveHint}
            saving={savingProfile}
            onSave={saveProfile}
          />

          {/* 中：大图 + 形态切换（最大元素） */}
          <CenterHeroPanel
            archive={archive}
            heroMode={heroMode}
            onHeroModeChange={setHeroMode}
            onSetCurrent={setCurrentMorph}
            onDelete={deleteMorph}
            onFeedback={openFeedback}
          />

          {/* 右：召唤 + 次操作（无卡片框） */}
          <RightSummonPanel
            archive={archive}
            deploying={deploying}
            deployProgress={deployProgress}
            usedCachedVideo={usedCachedVideo}
            onDeploy={handleDeploy}
            onToggleNeedsFix={toggleNeedsFix}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* 反馈弹窗 */}
      {feedbackTarget && (
        <FeedbackModal
          style={feedbackTarget.style}
          tags={feedbackTarget.tags}
          note={feedbackTarget.note}
          saving={savingFeedback}
          onChange={(next) => setFeedbackTarget({ ...feedbackTarget, ...next })}
          onClose={() => setFeedbackTarget(null)}
          onSubmit={submitFeedback}
        />
      )}
    </div>
  );
}

// =============================================================================
// 左：身份档案（无卡片框 + 底线式输入）
// =============================================================================
function LeftProfilePanel({
  archive,
  draft,
  setDraft,
  saveHint,
  saving,
  onSave
}: {
  archive: PetArchive;
  draft: PetArchive;
  setDraft: (next: PetArchive) => void;
  saveHint: string;
  saving: boolean;
  onSave: () => void;
}) {
  const fields: { key: keyof PetArchive; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: "petName", label: "名字", placeholder: "它叫什么名字？" },
    { key: "species", label: "物种", placeholder: "猫、狗、兔子..." },
    { key: "furColor", label: "毛色", placeholder: "浅橘色、黑白相间..." },
    { key: "eyeColor", label: "眼睛", placeholder: "偏蓝绿色、深棕色..." },
    { key: "earShape", label: "耳朵", placeholder: "大耳朵、折耳..." },
    { key: "bodyType", label: "体型", placeholder: "修长、圆润..." },
    { key: "petVibe", label: "性格", placeholder: "古怪、黏人、好奇...", multiline: true },
    { key: "customFeatures", label: "特殊特征", placeholder: "左耳有缺口、尾巴末端偏深...", multiline: true }
  ];

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-amber-700/70">
        身份档案
      </h2>

      <div className="space-y-3">
        {fields.map(({ key, label, placeholder, multiline }) => (
          <div key={key}>
            <label className="mb-1 block text-[11px] font-medium text-amber-700/80">
              {label}
            </label>
            {multiline ? (
              <textarea
                value={draft[key] as string}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                placeholder={placeholder}
                rows={2}
                className="w-full resize-none border-0 border-b border-amber-200/80 bg-transparent px-0 py-1.5 text-sm text-amber-900 placeholder:text-amber-400/70 focus:border-amber-700 focus:outline-none"
              />
            ) : (
              <input
                type="text"
                value={draft[key] as string}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full border-0 border-b border-amber-200/80 bg-transparent px-0 py-1.5 text-sm text-amber-900 placeholder:text-amber-400/70 focus:border-amber-700 focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* AI 视觉底稿（只读，作为参考；无卡片框） */}
      {archive.aiTags && archive.aiTags.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-medium text-amber-700/80">视觉印象（参考）</p>
          <div className="flex flex-wrap gap-1.5">
            {archive.aiTags.map((tag) => (
              <span key={tag} className="text-[11px] text-amber-700/70">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 保存按钮 */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-900 px-5 py-2 text-sm font-semibold text-amber-50 shadow-sm transition-colors hover:bg-amber-950 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存修改"}
        </button>
        {saveHint && (
          <span className="text-xs text-amber-700/80">{saveHint}</span>
        )}
      </div>
    </section>
  );
}

// =============================================================================
// 中：大图 + 形态切换（让宠物成为最大元素）
// =============================================================================
function CenterHeroPanel({
  archive,
  heroMode,
  onHeroModeChange,
  onSetCurrent,
  onDelete,
  onFeedback
}: {
  archive: PetArchive;
  heroMode: "morph" | "source";
  onHeroModeChange: (m: "morph" | "source") => void;
  onSetCurrent: (style: string) => void;
  onDelete: (style: string) => void;
  onFeedback: (style: string) => void;
}) {
  const results = archive.results ?? [];
  const currentIdx = Math.max(0, Math.min(archive.currentMorphIndex ?? 0, results.length - 1));
  const currentMorph = results[currentIdx] ?? null;
  const hasResults = results.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-amber-700/70">
        数字形象
      </h2>

      {/* 大图：让宠物成为最大元素 */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-amber-100/60 shadow-xl shadow-amber-900/5">
        {heroMode === "morph" && currentMorph ? (
          <img
            src={currentMorph.imageUrl}
            alt="当前数字形象"
            className="h-full w-full object-contain p-4"
          />
        ) : archive.sourceImage ? (
          <img
            src={`/api/archive/image/${archive.id}`}
            alt="原照片"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-5xl text-amber-400">
            🐾
          </div>
        )}

        {/* 左下：原图 / 数字形象 切换 */}
        {hasResults && archive.sourceImage && (
          <div className="absolute bottom-3 left-3 flex gap-1 rounded-full bg-white/85 p-1 text-[11px] backdrop-blur">
            <button
              onClick={() => onHeroModeChange("morph")}
              className={
                "rounded-full px-3 py-1 font-medium transition-colors " +
                (heroMode === "morph"
                  ? "bg-amber-900 text-amber-50"
                  : "text-amber-700/80 hover:text-amber-900")
              }
            >
              数字形象
            </button>
            <button
              onClick={() => onHeroModeChange("source")}
              className={
                "rounded-full px-3 py-1 font-medium transition-colors " +
                (heroMode === "source"
                  ? "bg-amber-900 text-amber-50"
                  : "text-amber-700/80 hover:text-amber-900")
              }
            >
              原照片
            </button>
          </div>
        )}
      </div>

      {/* 形态小图列表（无卡片框，间距留白） */}
      {hasResults ? (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {results.map((r, idx) => {
            const meta = getStyleLabel(r.style, idx);
            const isCurrent = idx === currentIdx;
            return (
              <div key={r.style} className="group relative">
                <button
                  onClick={() => onSetCurrent(r.style)}
                  className={
                    "relative h-16 w-16 overflow-hidden rounded-xl transition-all " +
                    (isCurrent
                      ? "ring-2 ring-amber-700 ring-offset-2 ring-offset-amber-50"
                      : "ring-1 ring-amber-200/60 hover:ring-amber-400")
                  }
                  title={meta.label}
                >
                  <img src={r.imageUrl} alt={meta.label} className="h-full w-full object-cover" />
                  {isCurrent && (
                    <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-amber-700 text-[9px] text-amber-50">
                      ✓
                    </span>
                  )}
                </button>
                <p className="mt-1 text-center text-[10px] text-amber-700/70">
                  {meta.emoji} {meta.label}
                </p>
                {/* 次操作：hover 时浮出 */}
                <div className="pointer-events-none absolute -top-2 right-0 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    onClick={() => onFeedback(r.style)}
                    className="grid h-6 w-6 place-items-center rounded-full bg-white text-amber-700 shadow ring-1 ring-amber-200 hover:bg-rose-50 hover:text-rose-600"
                    title="不像它？"
                  >
                    ✋
                  </button>
                  {results.length > 1 && (
                    <button
                      onClick={() => onDelete(r.style)}
                      className="grid h-6 w-6 place-items-center rounded-full bg-white text-amber-700 shadow ring-1 ring-amber-200 hover:bg-rose-50 hover:text-rose-600"
                      title="删除"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <Link
            href="/create"
            className="grid h-16 w-16 place-items-center rounded-xl text-amber-400 ring-1 ring-dashed ring-amber-300 transition-colors hover:bg-amber-50/60 hover:text-amber-700"
            title="生成新形象"
          >
            <span className="text-2xl">+</span>
          </Link>
        </div>
      ) : (
        <div className="mt-5 py-10 text-center">
          <p className="text-sm text-amber-700/80">还没有数字形象</p>
          <Link
            href="/create"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 underline-offset-4 hover:underline"
          >
            去为它生成第一个 →
          </Link>
        </div>
      )}
    </section>
  );
}

// =============================================================================
// 右：召唤 + 次操作（无卡片框）
// =============================================================================
function RightSummonPanel({
  archive,
  deploying,
  deployProgress,
  usedCachedVideo,
  onDeploy,
  onToggleNeedsFix,
  onDelete
}: {
  archive: PetArchive;
  deploying: boolean;
  deployProgress: { stage: "idle" | "animating" | "deploying" | "done" | "error"; percent: number; message: string; fraction: number };
  usedCachedVideo: boolean;
  onDeploy: () => void;
  onToggleNeedsFix: () => void;
  onDelete: () => void;
}) {
  const hasResults = (archive.results ?? []).length > 0;
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-amber-700/70">
        召唤到桌面
      </h2>

      {/* 主召唤按钮：永远最高优先级 */}
      <button
        type="button"
        onClick={onDeploy}
        disabled={!hasResults || deploying}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-amber-900 px-5 py-3 text-sm font-semibold text-amber-50 shadow-sm transition-colors hover:bg-amber-950 disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-500"
      >
        <span aria-hidden>🛋️</span>
        {deploying ? "正在召唤…" : "召唤到桌面（动态）"}
      </button>

      {/* 真实进度条：动画生成中 + 视频投放中都会显示 */}
      <DeployProgressBar progress={deployProgress} usedCached={usedCachedVideo} />

      {archive.deployedAt > 0 && (
        <p className="mt-2 text-[11px] text-amber-700/70">
          最近召唤：{new Date(archive.deployedAt).toLocaleString()}
        </p>
      )}

      {/* 浅分割线 */}
      <div className="my-6 h-px bg-amber-200/60" />

      {/* 次操作：弱化 */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onToggleNeedsFix}
          className={
            "block text-sm transition-colors " +
            (archive.needsFix
              ? "font-semibold text-amber-900"
              : "text-amber-700/80 hover:text-amber-900")
          }
        >
          {archive.needsFix ? "✋ 已标记为待调整" : "✋ 标记为待调整"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="block text-sm text-amber-600/70 transition-colors hover:text-rose-600"
        >
          🗑 删除整个档案
        </button>
      </div>
    </section>
  );
}

// =============================================================================
// 反馈弹窗（无卡片框 + 底线式输入）
// =============================================================================
function FeedbackModal({
  style,
  tags,
  note,
  saving,
  onChange,
  onClose,
  onSubmit
}: {
  style: string;
  tags: string[];
  note: string;
  saving: boolean;
  onChange: (next: Partial<{ tags: string[]; note: string }>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-amber-900">✋ 不像它？</h2>
        <p className="mt-1 text-xs text-amber-700/80">告诉 AI 哪里不像，下次会更准</p>

        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-[11px] font-medium text-amber-700/80">哪里不像？</p>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_TAGS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      onChange({
                        tags: active ? tags.filter((t) => t !== tag) : [...tags, tag]
                      })
                    }
                    className={
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-50/60 text-amber-800 hover:bg-amber-100")
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium text-amber-700/80">补充说明</p>
            <textarea
              value={note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="例如：它的耳朵应该更大，眼睛更偏蓝色。"
              rows={3}
              className="w-full resize-none border-0 border-b border-amber-200/80 bg-transparent px-0 py-1.5 text-sm text-amber-900 placeholder:text-amber-400/70 focus:border-amber-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-xs font-medium text-amber-700/80 hover:text-amber-900"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-full bg-amber-900 px-5 py-1.5 text-xs font-semibold text-amber-50 shadow-sm hover:bg-amber-950 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存反馈"}
          </button>
        </div>
      </div>
    </div>
  );
}
