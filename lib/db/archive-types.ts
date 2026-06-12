// 2026-06-09 Step 5：客户端安全（无 fs / undici）类型 + 常量 + 校验函数。
// 给 React 客户端组件 import 用，避免把 lib/db/archive.ts 里的 Node-only 代码
// 拉进 client bundle（Next.js 会报 "Module not found: Can't resolve 'fs'"）。
//
// 服务端仍然从 lib/db/archive.ts 走（那里有 fs / undici）。
// 这里只是把纯类型 + 常量 + 同步 sanitize 拆出来，做到 client/server 边界干净。

export type ArchiveImageInput = {
  base64: string;
  mimeType: string;
};

export interface PetArchive {
  id: string;
  createdAt: number;
  petName: string;
  petVibe: string;
  aiTags: string[];
  customFeatures: string;
  species: string;
  furColor: string;
  eyeColor: string;
  earShape: string;
  bodyType: string;
  deployedAt: number;
  needsFix: boolean;
  // 2026-06-09 绘本风：用户标记"最喜欢"（桃粉爱心）
  hasFav: boolean;
  currentMorphIndex: number;
  companionMode: CompanionMode;
  companionConfig: CompanionConfig;
  // 2026-06-09 Step 6.4：陪伴统计（温柔计数，不做打卡），给桌面端 / 详情页用。
  // 老数据 normalize 时初始化为 0，方便后续 Electron 桌宠上报。
  companionStats: CompanionStats;
  // 2026-06-09 Step 6.6：多宠物桌面策略（单只 / 随机 / 轮换）。MVP 只用 "single"。
  multiPetStrategy: MultiPetStrategy;
  // 2026-06-09 Step 6.4：最近一次召唤时间戳（毫秒）。0 = 从未召唤。
  // 跟 deployedAt 的区别：deployedAt 是"档案被召唤过"，lastSummonedAt 是"具体时间"。
  lastSummonedAt: number;
  // 2026-06-09 绘本风：累计互动数（页面顶栏"互动总数"用）。老数据 normalize 默认 0。
  interactionTotal: number;
  // 2026-06-09 绘本风：今日互动数（页面顶栏"今日互动"用）。老数据 normalize 默认 0。
  interactionToday: number;
  results: {
    style: string;
    imageUrl: string;
    videoUrl?: string;
    prompt?: string;
    createdAt?: number;
    feedback?: { tags: string[]; note: string } | null;
  }[];
  sourceImage?: { mimeType: string; ext: string };
}

// ===== Step 5：6 种陪伴模式 + 默认值 =====
export type CompanionMode = "quiet" | "breathe" | "nest" | "curious" | "dnd" | "active";
export const DEFAULT_COMPANION_MODE: CompanionMode = "quiet";

// ===== Step 5：6 项基础设置 =====
export type CompanionPosition = "right-bottom" | "left-bottom" | "right-top" | "left-top";
export type CompanionSize = "small" | "medium" | "large";
export type CompanionNest = "none" | "cushion" | "box" | "cloud";

export interface CompanionConfig {
  position: CompanionPosition;
  size: CompanionSize;
  alwaysOnTop: boolean;
  mousePassthrough: boolean;
  nestBackground: CompanionNest;
  autoSummon: boolean;
}

export const DEFAULT_COMPANION_CONFIG: CompanionConfig = {
  position: "right-bottom",
  size: "medium",
  alwaysOnTop: true,
  mousePassthrough: true,
  nestBackground: "cushion",
  autoSummon: false
};

// ===== Step 6.4：陪伴统计（温柔计数，不做打卡）=====
// 字段全部存累计值，每次 Electron 桌宠上报时把增量加进来。
// 不做"是否连续 7 天"这种强提醒，避免变成打卡压力。
export interface CompanionStats {
  // 累计陪伴毫秒数（Electron 端每次空闲唤醒/关闭时上报）
  totalAttentionMs: number;
  // 累计会话次数（用户点击桌宠一次算一次，不区分时长）
  interactionCount: number;
  // 鼠标靠近次数（"好奇模式"用）
  mouseFollowCount: number;
  // 最近一次会话起始时间戳
  lastSessionAt: number;
  // 最近 7 天出现过的天数（d1..d7 数组，1 = 出现，0 = 没出现）
  // 不存"连续天数"这种压力型指标
  weeklyPresence: number[];
}

export const DEFAULT_COMPANION_STATS: CompanionStats = {
  totalAttentionMs: 0,
  interactionCount: 0,
  mouseFollowCount: 0,
  lastSessionAt: 0,
  weeklyPresence: [0, 0, 0, 0, 0, 0, 0]
};

// ===== Step 6.6：多宠物桌面策略 =====
export type MultiPetStrategy = "single" | "random" | "rotate";
export const DEFAULT_MULTI_PET_STRATEGY: MultiPetStrategy = "single";

// ===== 白名单 + 同步 sanitize =====
const VALID_COMPANION_MODES: readonly CompanionMode[] = [
  "quiet",
  "breathe",
  "nest",
  "curious",
  "dnd",
  "active"
];
const VALID_POSITIONS: readonly CompanionPosition[] = [
  "right-bottom",
  "left-bottom",
  "right-top",
  "left-top"
];
const VALID_SIZES: readonly CompanionSize[] = ["small", "medium", "large"];
const VALID_NESTS: readonly CompanionNest[] = ["none", "cushion", "box", "cloud"];

export function isCompanionMode(v: unknown): v is CompanionMode {
  return typeof v === "string" && (VALID_COMPANION_MODES as readonly string[]).includes(v);
}
function isPosition(v: unknown): v is CompanionPosition {
  return typeof v === "string" && (VALID_POSITIONS as readonly string[]).includes(v);
}
function isSize(v: unknown): v is CompanionSize {
  return typeof v === "string" && (VALID_SIZES as readonly string[]).includes(v);
}
function isNest(v: unknown): v is CompanionNest {
  return typeof v === "string" && (VALID_NESTS as readonly string[]).includes(v);
}

// 同步白名单 sanitize，恶意 payload 不会污染数据。
export function sanitizeCompanionConfig(input: unknown): CompanionConfig {
  const cfg = (input && typeof input === "object" ? input : {}) as Partial<CompanionConfig>;
  return {
    position: isPosition(cfg.position) ? cfg.position : DEFAULT_COMPANION_CONFIG.position,
    size: isSize(cfg.size) ? cfg.size : DEFAULT_COMPANION_CONFIG.size,
    alwaysOnTop: typeof cfg.alwaysOnTop === "boolean" ? cfg.alwaysOnTop : DEFAULT_COMPANION_CONFIG.alwaysOnTop,
    mousePassthrough:
      typeof cfg.mousePassthrough === "boolean"
        ? cfg.mousePassthrough
        : DEFAULT_COMPANION_CONFIG.mousePassthrough,
    nestBackground: isNest(cfg.nestBackground) ? cfg.nestBackground : DEFAULT_COMPANION_CONFIG.nestBackground,
    autoSummon:
      typeof cfg.autoSummon === "boolean" ? cfg.autoSummon : DEFAULT_COMPANION_CONFIG.autoSummon
  };
}

// ===== Step 6.4：陪伴统计 sanitize =====
// - 数字字段：clamp 到非负整数（避免恶意负数）
// - weeklyPresence：长度 7 的 0/1 数组，超长截断，过滤非数字
export function sanitizeCompanionStats(input: unknown): CompanionStats {
  const s = (input && typeof input === "object" ? input : {}) as Partial<CompanionStats>;
  const clampNonNegInt = (v: unknown, max = Number.MAX_SAFE_INTEGER) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(max, Math.floor(v)));
  };
  let wp: number[] = DEFAULT_COMPANION_STATS.weeklyPresence.slice();
  if (Array.isArray(s.weeklyPresence)) {
    wp = s.weeklyPresence
      .slice(0, 7)
      .map((v) => (typeof v === "number" && (v === 0 || v === 1) ? v : 0));
    // 补齐到长度 7
    while (wp.length < 7) wp.push(0);
  }
  return {
    totalAttentionMs: clampNonNegInt(s.totalAttentionMs),
    interactionCount: clampNonNegInt(s.interactionCount),
    mouseFollowCount: clampNonNegInt(s.mouseFollowCount),
    lastSessionAt: clampNonNegInt(s.lastSessionAt),
    weeklyPresence: wp
  };
}

// ===== Step 6.6：多宠物策略 sanitize =====
const VALID_MULTI_PET_STRATEGIES: readonly MultiPetStrategy[] = ["single", "random", "rotate"];
export function isMultiPetStrategy(v: unknown): v is MultiPetStrategy {
  return typeof v === "string" && (VALID_MULTI_PET_STRATEGIES as readonly string[]).includes(v);
}
export function sanitizeMultiPetStrategy(input: unknown): MultiPetStrategy {
  return isMultiPetStrategy(input) ? input : DEFAULT_MULTI_PET_STRATEGY;
}
