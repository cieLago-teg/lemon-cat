"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { compressToBase64 } from "@/lib/image";
import { useDeployPet } from "@/app/components/useDeployPet";
import { DeployProgressBar } from "@/app/components/DeployProgressBar";

// 2026-06-09 商业化重构：消费级文案（去除"克隆 / MVP / GIF"等开发语言）
type CloneResult = {
  style: string;
  imageUrl: string;
  videoUrl?: string;
  prompt: string;
};

type Stage = "UPLOAD" | "READ_PHOTO" | "ANALYZE_FEATURES" | "GENERATE_MORPH" | "PREP_COMPANION" | "RESULTS";
type StepIndex = 1 | 2 | 3 | 4;

const stageToStep: Record<Stage, StepIndex> = {
  UPLOAD: 1,
  READ_PHOTO: 2,
  ANALYZE_FEATURES: 2,
  GENERATE_MORPH: 3,
  PREP_COMPANION: 3,
  RESULTS: 4
};

const STEP_LABELS: { idx: StepIndex; title: string; caption: string }[] = [
  { idx: 1, title: "上传照片", caption: "拖入一张宠物照片" },
  { idx: 2, title: "完善档案", caption: "确认它的数字档案" },
  { idx: 3, title: "选择形象", caption: "挑一张它最像的样子" },
  { idx: 4, title: "召唤到桌面", caption: "陪伴开始" }
];

// 阶段化进度文案
const STAGE_META: Record<
  Exclude<Stage, "UPLOAD" | "RESULTS">,
  { phase: string; lines: string[] }
> = {
  READ_PHOTO: {
    phase: "正在读取照片",
    lines: ["正在观察它的眼睛颜色...", "正在记录它的耳朵轮廓...", "正在保留它最特别的神态..."]
  },
  ANALYZE_FEATURES: {
    phase: "正在为它建立档案",
    lines: ["正在为它打上性格标签...", "正在为它匹配物种特征...", "正在记录它的小细节..."]
  },
  GENERATE_MORPH: {
    phase: "正在生成数字形象",
    lines: ["正在构建它的真实骨骼比例...", "正在还原它的自然神态...", "正在为它铺一层柔光..."]
  },
  PREP_COMPANION: {
    phase: "正在为它准备桌面小窝",
    lines: ["正在准备它的小窝...", "正在安排它的位置...", "正在配置桌面陪伴..."]
  }
};

const proxiedImage = (url: string) => `/api/image-proxy?url=${encodeURIComponent(url)}`;

// 上传建议（折叠起来）
const UPLOAD_TIPS = [
  { emoji: "🌅", text: "自然光，照片不要太暗" },
  { emoji: "🐾", text: "主体清晰，轮廓完整" },
  { emoji: "🎯", text: "正脸或 3/4 侧面最佳" },
  { emoji: "🌿", text: "背景简单，避免杂物和多人" }
];

// 失败温和分类
const FAIL_REASONS: { icon: string; text: string }[] = [
  { icon: "🌑", text: "原图太暗，模型看不清楚细节" },
  { icon: "✂️", text: "宠物轮廓不完整（被裁掉 / 虚化）" },
  { icon: "🌀", text: "背景干扰较多" },
  { icon: "🪶", text: "特征描述还不够明确" }
];

// 8 字段档案
type ProfileFields = {
  species: string;
  furColor: string;
  eyeColor: string;
  earShape: string;
  bodyType: string;
};
const PROFILE_FIELD_LABELS: { key: keyof ProfileFields; label: string; placeholder: string }[] = [
  { key: "species", label: "物种", placeholder: "例如：猫、狗、兔子..." },
  { key: "furColor", label: "毛色", placeholder: "例如：浅橘色、黑白相间..." },
  { key: "eyeColor", label: "眼睛", placeholder: "例如：偏蓝绿色、深棕色..." },
  { key: "earShape", label: "耳朵", placeholder: "例如：大耳朵、折耳..." },
  { key: "bodyType", label: "体型", placeholder: "例如：无毛猫，身体修长..." }
];
const EMPTY_PROFILE: ProfileFields = {
  species: "",
  furColor: "",
  eyeColor: "",
  earShape: "",
  bodyType: ""
};

// ============================================================================
// 主页面：左上传 / 右效果预览（消费级布局）
// ============================================================================
export default function HomePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("UPLOAD");
  const [selectedName, setSelectedName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [errorStage, setErrorStage] = useState<"UPLOAD" | "EXTRACT" | "GENERATE">("UPLOAD");
  const stageStartedAtRef = useRef<number>(Date.now());

  const [petName, setPetName] = useState("");
  const [personality, setPersonality] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [customFeatures, setCustomFeatures] = useState("");
  const [profile, setProfile] = useState<ProfileFields>(EMPTY_PROFILE);
  const [aiSuggested, setAiSuggested] = useState<ProfileFields>(EMPTY_PROFILE);
  const [results, setResults] = useState<CloneResult[]>([]);
  const [selectedResultIdx, setSelectedResultIdx] = useState<number | null>(null);
  const [deployed, setDeployed] = useState<"none" | "video">("none");
  const [deploying, setDeploying] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showFailPanel, setShowFailPanel] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const [animState, setAnimState] = useState<{
    stage: string;
    videoUrl: string | null;
    taskId: string | null;
    percent?: number;
    message?: string;
  }>({ stage: "idle", videoUrl: null, taskId: null, percent: 0, message: "" });

  // 2026-06-12: 召唤到桌面只走视频，没有 videoUrl 就触发动画生成，全程显示真实进度。
  const { progress: deployProgress, error: deployError, hint: deployHint, deploy, usedCachedVideo } = useDeployPet();

  const currentStep: StepIndex = stageToStep[stage];
  const phaseStage: Exclude<Stage, "UPLOAD" | "RESULTS"> | null =
    stage === "READ_PHOTO" || stage === "ANALYZE_FEATURES" || stage === "GENERATE_MORPH" || stage === "PREP_COMPANION"
      ? stage
      : null;

  useEffect(() => {
    setShowFailPanel(Boolean(error) && (errorStage === "EXTRACT" || errorStage === "GENERATE"));
  }, [error, errorStage]);

  // 上传文件：进入 4 阶段
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }
    setError("");
    setLastFile(file);
    setSelectedName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    stageStartedAtRef.current = Date.now();
    setStage("READ_PHOTO");
    void extractFeatures(file);
  };

  const extractFeatures = async (file: File) => {
    try {
      const payload = await compressToBase64(file);
      await new Promise((r) => setTimeout(r, 1200));
      setStage("ANALYZE_FEATURES");
      stageStartedAtRef.current = Date.now();

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data) {
        throw new Error(data?.error ?? `提取失败 (${response.status})`);
      }
      setAiTags(data.tags || []);

      const rawText: string = typeof data.petFeatures === "string" ? data.petFeatures : "";
      const suggested = inferProfileFromText(rawText);
      setAiSuggested(suggested);
      setProfile(suggested);
      await new Promise((r) => setTimeout(r, 600));
      setStage("UPLOAD");
      setShowProfile(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
      setErrorStage("EXTRACT");
      setStage("UPLOAD");
    }
  };

  const removeTag = (index: number) => setAiTags(aiTags.filter((_, i) => i !== index));

  const confirmProfileAndGenerate = () => {
    if (!petName.trim()) {
      setError("请先给它起个名字哦！");
      return;
    }
    stageStartedAtRef.current = Date.now();
    setStage("GENERATE_MORPH");
    setError("");
    void startGeneration();
  };

  const startGeneration = async () => {
    setResults([]);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petName,
          petVibe: personality,
          aiTags,
          customFeatures,
          bgMode: "white"
        })
      });
      const data = await response.json();
      if (!response.ok || !data) throw new Error(data?.error ?? `生成失败 (${response.status})`);
      setResults(data.results);
      setStage("PREP_COMPANION");
      stageStartedAtRef.current = Date.now();
      await new Promise((r) => setTimeout(r, 1500));
      setStage("RESULTS");
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
      setErrorStage("GENERATE");
      setStage("UPLOAD");
      setShowProfile(true);
    }
  };

  const resetAll = () => {
    setStage("UPLOAD");
    setPetName("");
    setPersonality("");
    setAiTags([]);
    setCustomFeatures("");
    setProfile(EMPTY_PROFILE);
    setAiSuggested(EMPTY_PROFILE);
    setResults([]);
    setSelectedResultIdx(null);
    setDeployed("none");
    setPreviewUrl("");
    setLastFile(null);
    setSelectedName("");
    setError("");
    setShowProfile(false);
    setShowFailPanel(false);
    setSaveHint("");
    setAnimState({ stage: "idle", videoUrl: null, taskId: null, percent: 0, message: "" });
  };

  const handleDeploy = async () => {
    if (selectedResultIdx === null) {
      setError("请先选一张数字形象，再召唤到桌面。");
      return;
    }
    const target = results[selectedResultIdx];
    if (!target) return;
    setDeploying(true);
    setError("");
    setDeployed("none");
    const deployResult = await deploy({
      imageUrl: target.imageUrl,
      videoUrl: target.videoUrl || animState.videoUrl || null,
      style: target.style
    });
    if (deployResult.ok) {
      if (deployResult.videoUrl) {
        setAnimState((prev) => ({
          ...prev,
          stage: "done",
          videoUrl: deployResult.videoUrl,
          percent: 100,
          message: "生成完成"
        }));
        setResults((prev) =>
          prev.map((item, idx) => (idx === selectedResultIdx ? { ...item, videoUrl: deployResult.videoUrl || undefined } : item))
        );
      }
      setDeployed("video");
    }
    setDeploying(false);
  };

  const handleAnimate = async () => {
    if (selectedResultIdx === null) return;
    const target = results[selectedResultIdx];
    if (!target) return;
    setAnimState({ stage: "提交中...", videoUrl: null, taskId: null, percent: 0, message: "正在提交任务" });
    setError("");
    try {
      const res = await fetch("/api/pet/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: target.imageUrl,
          style: target.style
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.taskId) throw new Error(data?.error ?? `提交失败 (${res.status})`);
      const taskId: string = data.taskId;
      setAnimState((prev) => ({ ...prev, stage: "排队中", taskId, percent: 10, message: "已提交到 Wan 队列" }));

      const pollInterval = setInterval(async () => {
        try {
          const s = await fetch(`/api/pet/animation-status?taskId=${taskId}`);
          const sd = await s.json();
          const task = sd?.task;
          if (task?.stage === "Success" && task?.videoUrl) {
            setAnimState({
              stage: "done",
              videoUrl: task.videoUrl,
              taskId,
              percent: 100,
              message: task.message || "生成完成"
            });
            clearInterval(pollInterval);
          } else if (task?.stage === "Failure") {
            setAnimState({ stage: "idle", videoUrl: null, taskId: null, percent: 0, message: "生成失败" });
            setError(task.message || task.error || "动画生成失败");
            clearInterval(pollInterval);
          } else {
            setAnimState((prev) => ({
              ...prev,
              stage: task?.stage ?? prev.stage,
              percent: typeof task?.percent === "number" ? task.percent : prev.percent,
              message: task?.message || prev.message
            }));
          }
        } catch {
          // keep polling
        }
      }, 2500);
    } catch (e) {
      setAnimState({ stage: "idle", videoUrl: null, taskId: null, percent: 0, message: "" });
      setError(e instanceof Error ? e.message : "动画提交失败");
    }
  };

  const handleDeployVideo = async () => {
    if (!animState.videoUrl) return;
    setDeploying(true);
    setError("");
    setDeployed("none");
    const deployResult = await deploy({
      imageUrl: results[selectedResultIdx ?? 0]?.imageUrl || "",
      videoUrl: animState.videoUrl
    });
    if (deployResult.ok) setDeployed("video");
    setDeploying(false);
  };

  const handleSave = async () => {
    if (!petName) {
      setError("请先给宠物起个名字再保存档案哦！");
      return;
    }
    if (selectedResultIdx === null) {
      setError("请先选择一张数字形象再保存。");
      return;
    }
    setSaveHint("保存中...");
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petName,
          petVibe: personality,
          aiTags,
          customFeatures,
          species: profile.species,
          furColor: profile.furColor,
          eyeColor: profile.eyeColor,
          earShape: profile.earShape,
          bodyType: profile.bodyType,
          deployedAt: deployed !== "none" ? Date.now() : 0,
          lastSummonedAt: deployed !== "none" ? Date.now() : 0,
          needsFix: false,
          currentMorphIndex: 0,
          results: [
            {
              ...results[selectedResultIdx],
              ...(animState.videoUrl ? { videoUrl: animState.videoUrl } : {}),
              createdAt: Date.now(),
              feedback: null
            }
          ],
          sourceImage: lastFile
            ? await compressToBase64(lastFile).then((p) => ({
                base64: p.imageBase64,
                mimeType: p.mimeType
              }))
            : undefined
        })
      });
      if (!res.ok) throw new Error("保存失败");
      const data = await res.json();
      const newId = data?.archive?.id;
      if (newId) router.push(`/create/success?id=${newId}`);
      else router.push("/pets");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存档案失败");
      setSaveHint("");
    }
  };

  // 选中的预览图（用于右侧预览区）
  const previewImage =
    stage === "RESULTS" && selectedResultIdx !== null
      ? results[selectedResultIdx]?.imageUrl
      : previewUrl || null;

  return (
    <>
      {/* 背景图：fixed 铺满整个视口（含 AppNav 位置） */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-wallpaper-upload bg-wallpaper-cover"
      />
      <main className="relative flex h-screen flex-col mx-auto w-full max-w-6xl px-6 pt-4 sm:pt-6 overflow-hidden">
      {/* 极简 4 步进度（顶部一条线 + 数字） */}
      <StepRibbon current={currentStep} />

      <div className="flex-1 overflow-y-auto">
      {/* 4 阶段进度（生成中时替代主 UI） */}
      {phaseStage ? (
        <div className="mt-10">
          <StageProgress stage={phaseStage} startedAt={stageStartedAtRef.current} previewUrl={previewUrl} />
        </div>
      ) : stage === "UPLOAD" && showFailPanel ? (
        <FailedPanel
          error={error}
          onRetry={() => {
            setError("");
            setShowFailPanel(false);
            confirmProfileAndGenerate();
          }}
          onBack={() => {
            setError("");
            setShowFailPanel(false);
            resetAll();
          }}
        />
      ) : stage === "UPLOAD" && showProfile ? (
        // Step 2：八字段编辑（识别完成后）
        <ProfileEditor
          previewUrl={previewImage}
          petName={petName}
          setPetName={setPetName}
          personality={personality}
          setPersonality={setPersonality}
          customFeatures={customFeatures}
          setCustomFeatures={setCustomFeatures}
          aiTags={aiTags}
          removeTag={removeTag}
          onBack={resetAll}
          onContinue={confirmProfileAndGenerate}
        />
      ) : stage === "UPLOAD" ? (
        // 初始首屏：左侧上传 / 右侧预览
        <UploadHero
          selectedName={selectedName}
          onFileChange={onFileChange}
          showTips={showTips}
          setShowTips={setShowTips}
          error={error && !showFailPanel ? error : ""}
          previewUrl={previewImage}
        />
      ) : (
        // stage === "RESULTS"
        <ResultsStage
          results={results}
          selectedResultIdx={selectedResultIdx}
          setSelectedResultIdx={setSelectedResultIdx}
          petName={petName}
          handleDeploy={handleDeploy}
          deploying={deploying}
          deployed={deployed}
          handleSave={handleSave}
          saveHint={saveHint}
          proxiedImage={proxiedImage}
          animState={animState}
          handleAnimate={handleAnimate}
          handleDeployVideo={handleDeployVideo}
          deployProgress={deployProgress}
          usedCachedVideo={usedCachedVideo}
        />
      )}

      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
    </>
  );
}

// ============================================================================
// 极简进度条：顶部一条线 + 4 圆点（不抢戏）
// ============================================================================
function StepRibbon({ current }: { current: StepIndex }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <ol className="flex flex-1 items-center gap-3 sm:gap-4">
        {STEP_LABELS.map((s, i) => {
          const done = s.idx < current;
          const active = s.idx === current;
          return (
            <li key={s.idx} className="flex flex-1 items-center gap-2 sm:gap-3">
              <span
                className={
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] transition-colors " +
                  (active
                    ? "bg-amber-700 font-semibold text-amber-50"
                    : done
                      ? "bg-amber-200 text-[#5c2e10]"
                      : "text-[#5c2e10]/40 ring-1 ring-inset ring-amber-200")
                }
                aria-hidden
              >
                {done ? "✓" : s.idx}
              </span>
              <span
                className={
                  "hidden text-[12px] sm:inline " +
                  (active
                    ? "font-medium text-[#5c2e10]"
                    : done
                      ? "text-[#5c2e10]"
                      : "text-[#5c2e10]/60")
                }
              >
                {s.title}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <span
                  className={
                    "h-px flex-1 transition-colors " + (done ? "bg-amber-300" : "bg-amber-200/60")
                  }
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ============================================================================
// 初始首屏：左上传 / 右效果预览（消费级布局）
// ============================================================================
function UploadHero({
  selectedName,
  onFileChange,
  showTips,
  setShowTips,
  error,
  previewUrl
}: {
  selectedName: string;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  showTips: boolean;
  setShowTips: (v: boolean) => void;
  error: string;
  previewUrl: string | null;
}) {
  return (
    <div className="mt-8">
      {/* 标题 + 上传 + 折叠建议 */}
      <div>
        <h1 className="mt-2 text-4xl font-normal leading-tight text-[#5c2e10] sm:text-5xl">
          让它，<br className="hidden sm:block" />
          <span>永远陪着你</span>
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[#5c2e10]/80">
          上传一张照片，我们会为它建立一份温柔的赛博档案。它将安静地坐在你桌面的角落。
        </p>

        <label className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-amber-900 px-7 py-3.5 text-sm font-medium text-amber-50 shadow-lg shadow-amber-900/10 transition hover:bg-amber-800">
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          <span aria-hidden>📷</span>
          {selectedName ? "重新选择照片" : "选择一张照片"}
        </label>
        {selectedName && (
          <p className="mt-3 text-xs text-[#5c2e10]/80">
            已选：<span className="font-medium text-[#5c2e10]">{selectedName}</span>
          </p>
        )}
        {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}

        {/* 上传建议折叠 */}
        <div className="mt-8 max-w-md">
          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-1.5 text-xs text-[#5c2e10]/80 hover:text-[#5c2e10]"
          >
            <span className={"inline-block transition-transform " + (showTips ? "rotate-90" : "")} aria-hidden>
              ›
            </span>
            如何选择一张好照片？
          </button>
          {showTips && (
            <ul className="mt-3 space-y-1.5 text-xs text-[#5c2e10]/80">
              {UPLOAD_TIPS.map((t) => (
                <li key={t.text} className="flex items-start gap-2">
                  <span aria-hidden>{t.emoji}</span>
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 阶段化进度（生成中时显示）
// ============================================================================
function StageProgress({
  stage,
  startedAt,
  previewUrl
}: {
  stage: Exclude<Stage, "UPLOAD" | "RESULTS">;
  startedAt: number;
  previewUrl: string;
}) {
  const meta = STAGE_META[stage];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
    const t = setInterval(() => setIdx((i) => i + 1), 2500);
    return () => clearInterval(t);
  }, [stage]);
  const line = meta.lines[idx % meta.lines.length];

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const showLongWait = now - startedAt > 30_000;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div>
        <p className="text-sm text-[#5c2e10]/80">第 2 步 · 完善档案</p>
        <h2 className="mt-2 text-3xl font-medium text-[#5c2e10]">它的样子，我们都记下了</h2>

        {previewUrl && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-amber-100/40 shadow-lg shadow-amber-900/5" style={{ aspectRatio: "1 / 1" }}>
            <img src={previewUrl} alt="原始照片" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <div className="rounded-[28px] bg-white/55 px-6 py-7 backdrop-blur-xl ring-1 ring-white/60 shadow-lg shadow-amber-900/5">
        <p className="text-xs uppercase tracking-widest text-[#5c2e10]/70">{meta.phase}</p>
        <p className="mt-3 text-2xl font-medium text-[#5c2e10]" style={{ minHeight: "1.5em" }} key={line}>
          <span className="inline-block animate-[fadeIn_0.4s_ease-out]">{line}</span>
        </p>
        <div className="mt-4 flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" style={{ animationDelay: "200ms" }} />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" style={{ animationDelay: "400ms" }} />
        </div>

        {showLongWait && (
          <div className="mt-8 max-w-md text-sm text-[#5c2e10]/80">
            <p>生成可能还需要一会儿，你可以先离开。</p>
            <p className="mt-1 text-xs text-[#5c2e10]/70">完成后我们会在档案馆提醒你。</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <Link
                href="/pets"
                className="rounded-full bg-white/70 px-4 py-2 text-[#5c2e10] shadow-sm ring-1 ring-amber-200 hover:bg-white"
              >
                先去档案馆看看
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("pet-clone:waitingNotify", "1");
                  }
                  window.location.href = "/pets";
                }}
                className="text-[#5c2e10]/80 hover:text-[#5c2e10]"
              >
                生成完成后通知我 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 失败恢复面板
// ============================================================================
function FailedPanel({ error, onRetry, onBack }: { error: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="mx-auto mt-12 max-w-xl">
      <h2 className="text-2xl font-medium text-[#5c2e10]">这次没有成功生成理想形象</h2>
      <p className="mt-2 text-sm text-[#5c2e10]/80">没关系，我们一起看看是哪里不对。</p>

      <ul className="mt-6 space-y-2 text-sm text-[#5c2e10]/80">
        {FAIL_REASONS.map((r) => (
          <li key={r.text} className="flex items-start gap-2">
            <span aria-hidden>{r.icon}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-rose-700/80">技术细节：{error}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#5c2e10]/80 hover:text-[#5c2e10]"
        >
          🔄 换一张照片
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[#5c2e10]/80 hover:text-[#5c2e10]"
        >
          ✏️ 修改特征描述
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-amber-900 px-5 py-2.5 text-sm font-medium text-amber-50 hover:bg-amber-800"
        >
          ⚡ 重新生成
        </button>
        <Link
          href="/pets"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#5c2e10] ring-1 ring-amber-200 hover:bg-amber-50"
        >
          用当前结果继续
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// 八字段编辑（识别完成后）
// ============================================================================
function ProfileEditor(props: {
  previewUrl: string | null;
  petName: string;
  setPetName: (v: string) => void;
  personality: string;
  setPersonality: (v: string) => void;
  customFeatures: string;
  setCustomFeatures: (v: string) => void;
  aiTags: string[];
  removeTag: (i: number) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      {/* 左：原始照片 */}
      <div>
        <p className="text-sm text-[#5c2e10]/80">第 2 步 · 完善档案</p>
        <h2 className="mt-2 text-3xl font-medium text-[#5c2e10]">它的样子，我们都记下了</h2>

        {props.previewUrl && (
          <div className="mt-6 overflow-hidden rounded-3xl bg-amber-100/40 shadow-lg shadow-amber-900/5" style={{ aspectRatio: "1 / 1" }}>
            <img src={props.previewUrl} alt="原始照片" className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {/* 右：磨砂卡片（名字 + 用户补充 + 标签 + 按钮） */}
      <div className="rounded-[28px] bg-white/55 px-8 py-9 backdrop-blur-xl ring-1 ring-white/60 shadow-lg shadow-amber-900/5">
        <label className="block text-xs text-[#5c2e10]/80">名字 <span className="text-rose-600">*</span></label>
        <input
          type="text"
          value={props.petName}
          onChange={(e) => props.setPetName(e.target.value)}
          placeholder="例如：尖叫、咪咪、Rex..."
          className="mt-2 w-full border-0 border-b border-amber-200 bg-transparent py-2 text-2xl font-medium text-[#5c2e10] placeholder:text-[#5c2e10]/35 focus:border-amber-600 focus:outline-none"
        />

        <div className="mt-10 space-y-6">
          <div>
            <label className="text-xs text-[#5c2e10]/80">性格</label>
            <input
              type="text"
              value={props.personality}
              onChange={(e) => props.setPersonality(e.target.value)}
              placeholder="例如：机警、沉稳、温和"
              className="mt-2 w-full border-0 border-b border-amber-200 bg-transparent py-2 text-base text-[#5c2e10] placeholder:text-[#5c2e10]/35 focus:border-amber-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-[#5c2e10]/80">补充特征</label>
            <input
              type="text"
              value={props.customFeatures}
              onChange={(e) => props.setCustomFeatures(e.target.value)}
              placeholder="例如：右耳有缺口、尾巴末端偏深色"
              className="mt-2 w-full border-0 border-b border-amber-200 bg-transparent py-2 text-base text-[#5c2e10] placeholder:text-[#5c2e10]/35 focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>

        {props.aiTags.length > 0 && (
          <div className="mt-8 border-t border-amber-200/50 pt-6">
            <p className="mb-3 text-xs text-[#5c2e10]/80">AI 识别标签（点击移除）</p>
            <div className="flex flex-wrap gap-1.5">
              {props.aiTags.map((tag, i) => (
                <span
                  key={i}
                  onClick={() => props.removeTag(i)}
                  className="cursor-pointer rounded-full bg-amber-100/60 px-3 py-1 text-xs text-[#5c2e10] hover:bg-rose-100 hover:text-rose-700"
                >
                  {tag} ×
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={props.onContinue}
            className="rounded-full bg-amber-900 px-7 py-3 text-sm font-medium text-amber-50 shadow-lg shadow-amber-900/10 hover:bg-amber-800"
          >
            让它诞生 ✨
          </button>
          <button
            type="button"
            onClick={props.onBack}
            className="text-sm text-[#5c2e10]/80 hover:text-[#5c2e10]"
          >
            重新上传
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3+4：选形态 + 召唤
// ============================================================================
function ResultsStage({
  results,
  selectedResultIdx,
  setSelectedResultIdx,
  petName,
  handleDeploy,
  deploying,
  deployed,
  handleSave,
  saveHint,
  proxiedImage,
  animState,
  handleAnimate,
  handleDeployVideo,
  deployProgress,
  usedCachedVideo
}: {
  results: CloneResult[];
  selectedResultIdx: number | null;
  setSelectedResultIdx: (i: number) => void;
  petName: string;
  handleDeploy: () => void;
  deploying: boolean;
  deployed: "none" | "video";
  handleSave: () => void;
  saveHint: string;
  proxiedImage: (url: string) => string;
  animState: { stage: string; videoUrl: string | null; taskId: string | null; percent?: number; message?: string };
  handleAnimate: () => void;
  handleDeployVideo: () => void;
  deployProgress: { stage: "idle" | "animating" | "deploying" | "done" | "error"; percent: number; message: string; fraction: number };
  usedCachedVideo: boolean;
}) {
  const isAnimating = animState.stage !== "idle" && animState.stage !== "done" && animState.videoUrl === null;
  return (
    <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr]">
      {/* 左：宠物预览（最大元素） */}
      <div>
        <p className="text-sm text-[#5c2e10]/80">第 3 步 · 选择形象</p>
        <h2 className="mt-2 text-3xl font-medium text-[#5c2e10]">{petName}，从照片里走出来了</h2>

        <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-rose-50/40 to-amber-50 shadow-xl shadow-amber-900/5" style={{ aspectRatio: "1 / 1" }}>
          {animState.videoUrl ? (
            <video
              src={animState.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          ) : selectedResultIdx !== null && results[selectedResultIdx] ? (
            <img
              src={proxiedImage(results[selectedResultIdx].imageUrl)}
              alt={results[selectedResultIdx].style}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="grid h-full place-items-center text-[#5c2e10]/40">点击下方挑一张</div>
          )}
        </div>

        {isAnimating && (
          <div className="mt-3">
            <p className="text-xs text-[#5c2e10]/70">🪄 {animState.message || animState.stage}…</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60">
              <div
                className="h-full bg-amber-700 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(4, animState.percent ?? 0)}%` }}
              />
            </div>
          </div>
        )}
        {deployed !== "none" && (
          <p className="mt-4 text-sm text-emerald-700">✓ 它已经出现在桌面啦（如未弹出，运行 npm run dev:pet-shell）</p>
        )}
      </div>

      {/* 右：候选形态 + 主按钮 */}
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((item, idx) => {
            const selected = selectedResultIdx === idx;
            return (
              <button
                key={item.style}
                type="button"
                onClick={() => setSelectedResultIdx(idx)}
                className={
                  "overflow-hidden rounded-2xl bg-amber-50/40 text-left transition " +
                  (selected ? "ring-2 ring-amber-900" : "ring-1 ring-amber-200/50 hover:ring-amber-400")
                }
              >
                <img src={proxiedImage(item.imageUrl)} alt={item.style} className="aspect-square w-full object-cover" />
                <div className="px-2 py-1.5 text-[11px] text-[#5c2e10]">
                  {item.style} · {petName}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDeploy}
            disabled={selectedResultIdx === null || deploying}
            className="rounded-full bg-amber-900 px-7 py-3.5 text-sm font-medium text-amber-50 shadow-lg shadow-amber-900/10 hover:bg-amber-800 disabled:opacity-50"
          >
            {deploying ? "正在召唤…" : "🪄 召唤到桌面（动态）"}
          </button>
          {/* 真实进度条：召唤中 + 动画生成中都会显示 */}
          <DeployProgressBar progress={deployProgress} usedCached={usedCachedVideo} />

          {animState.videoUrl && !deploying ? (
            <button
              type="button"
              onClick={handleDeployVideo}
              disabled={deploying}
              className="rounded-full bg-emerald-900 px-7 py-3.5 text-sm font-medium text-amber-50 shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 disabled:opacity-50"
            >
              ✨ 立即投放刚才的动态桌宠
            </button>
          ) : animState.stage === "done" && animState.videoUrl ? null : (
            <button
              type="button"
              onClick={handleAnimate}
              disabled={selectedResultIdx === null || isAnimating || deploying}
              className="rounded-full bg-white/70 px-7 py-3.5 text-sm font-medium text-[#5c2e10] ring-1 ring-amber-200 hover:bg-white disabled:opacity-50"
            >
              {isAnimating ? `🪄 ${animState.message || animState.stage}…` : "🎬 提前为它注入生命"}
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={selectedResultIdx === null}
            className="text-sm text-[#5c2e10]/80 hover:text-[#5c2e10]"
          >
            {saveHint || "保存到我的宠物档案 →"}
          </button>
          <Link href="/pets" className="text-sm text-[#5c2e10]/80 hover:text-[#5c2e10]">
            查看我的赛博档案库 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// 启发式推断：跟 Step 2 一致
function inferProfileFromText(rawText: string) {
  const text = (rawText || "").toLowerCase();
  const result: ProfileFields = { ...EMPTY_PROFILE };

  const speciesMatch = text.match(/(猫|狗|兔|鼠|鸟|仓鼠|刺猬|龟|蜥蜴|金鱼|猫[咪咪]?)/);
  if (speciesMatch) {
    const v = speciesMatch[1];
    result.species =
      v.startsWith("猫") ? "猫" :
      v.startsWith("狗") ? "狗" :
      v.startsWith("兔") ? "兔" :
      v.startsWith("鼠") ? "鼠" :
      v.startsWith("鸟") ? "鸟" : v;
  }

  const colorPatterns: { regex: RegExp; out: string }[] = [
    { regex: /(橘|橙|姜黄|浅橘|深橘|黄)/, out: "橘色" },
    { regex: /(黑|墨|乌|深色)/, out: "黑色" },
    { regex: /(白|奶|米色|雪白|纯白)/, out: "白色" },
    { regex: /(灰|银|蓝灰|烟)/, out: "灰色" },
    { regex: /(棕|咖|褐|巧克力)/, out: "棕色" },
    { regex: /(虎斑|条纹)/, out: "虎斑" },
    { regex: /(三花|玳瑁)/, out: "三花" }
  ];
  for (const p of colorPatterns) {
    if (p.regex.test(text)) {
      result.furColor = p.out;
      break;
    }
  }

  if (/(蓝|碧|湖蓝|天蓝)/.test(text)) result.eyeColor = "蓝色";
  else if (/(绿|碧绿|翡翠)/.test(text)) result.eyeColor = "绿色";
  else if (/(棕|咖|深棕|琥珀)/.test(text)) result.eyeColor = "棕色";
  else if (/(异色|鸳鸯|阴阳)/.test(text)) result.eyeColor = "异色";

  if (/(折耳|垂耳|耷拉)/.test(text)) result.earShape = "折耳";
  else if (/(大耳|竖耳|尖耳|长耳)/.test(text)) result.earShape = "大耳朵";
  else if (/(小耳|短耳)/.test(text)) result.earShape = "小耳朵";

  if (/(无毛|斯芬克斯|spinx)/.test(text)) result.bodyType = "无毛";
  else if (/(胖|圆|肥|壮)/.test(text)) result.bodyType = "圆润";
  else if (/(瘦|修长|纤细|苗条)/.test(text)) result.bodyType = "修长";
  else if (/(大|巨型|大型)/.test(text)) result.bodyType = "大型";
  else if (/(小|迷你|娇小)/.test(text)) result.bodyType = "小型";

  return result;
}
