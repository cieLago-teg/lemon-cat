import fs from "fs";
import path from "path";
import { Agent, fetch as undiciFetch } from "undici";

// 2026-06-09 Step 5：所有 PetArchive / CompanionConfig 等类型 + 默认值 +
// sanitizeCompanionConfig 都在 archive-types.ts 里。archive.ts 这里是 server-only
// 实现（用 fs / undici），不能再 import 客户端组件。客户端组件请 import archive-types。
import type {
  ArchiveImageInput,
  PetArchive
} from "./archive-types";
import {
  DEFAULT_COMPANION_MODE,
  isCompanionMode,
  isMultiPetStrategy,
  sanitizeCompanionConfig,
  sanitizeCompanionStats,
  sanitizeMultiPetStrategy
} from "./archive-types";

// 兼容老 import：从 archive.ts 直接拿类型/常量/函数。
export type {
  ArchiveImageInput,
  PetArchive,
  CompanionMode,
  CompanionPosition,
  CompanionSize,
  CompanionNest,
  CompanionConfig,
  CompanionStats,
  MultiPetStrategy
} from "./archive-types";
export {
  DEFAULT_COMPANION_MODE,
  DEFAULT_COMPANION_CONFIG,
  DEFAULT_COMPANION_STATS,
  DEFAULT_MULTI_PET_STRATEGY,
  isCompanionMode,
  isMultiPetStrategy,
  sanitizeCompanionConfig,
  sanitizeCompanionStats,
  sanitizeMultiPetStrategy
} from "./archive-types";

const DB_FILE = path.join(process.cwd(), "data", "archives.json");
const IMAGE_DIR = path.join(process.cwd(), "data", "archive-images");

function ensureDbExists() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]), "utf-8");
  }
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

// 2026-06-04 修复：早期版本的 archive 写入逻辑没有严格校验必填字段，
// 数据落盘后偶发出现 aiTags/results 为 undefined 的情况。读出来直接交给
// 前端就会炸 "Cannot read properties of undefined (reading 'map')"。
// 这里在读时做一次"缺啥补啥"的归一化，让脏数据不会把页面带崩。
function normalizeArchive(raw: unknown): PetArchive {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<PetArchive>;
  return {
    id: typeof obj.id === "string" ? obj.id : Date.now().toString(),
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    petName: typeof obj.petName === "string" ? obj.petName : "未命名宠物",
    petVibe: typeof obj.petVibe === "string" ? obj.petVibe : "",
    aiTags: Array.isArray(obj.aiTags) ? obj.aiTags.filter((t) => typeof t === "string") : [],
    customFeatures: typeof obj.customFeatures === "string" ? obj.customFeatures : "",
    species: typeof obj.species === "string" ? obj.species : "",
    furColor: typeof obj.furColor === "string" ? obj.furColor : "",
    eyeColor: typeof obj.eyeColor === "string" ? obj.eyeColor : "",
    earShape: typeof obj.earShape === "string" ? obj.earShape : "",
    bodyType: typeof obj.bodyType === "string" ? obj.bodyType : "",
    deployedAt: typeof obj.deployedAt === "number" && Number.isFinite(obj.deployedAt) ? obj.deployedAt : 0,
    needsFix: typeof obj.needsFix === "boolean" ? obj.needsFix : false,
    // 2026-06-09 绘本风：老数据默认未标记最喜欢
    hasFav: typeof obj.hasFav === "boolean" ? obj.hasFav : false,
    currentMorphIndex:
      typeof obj.currentMorphIndex === "number" &&
      Number.isInteger(obj.currentMorphIndex) &&
      obj.currentMorphIndex >= 0
        ? obj.currentMorphIndex
        : 0,
    // 2026-06-09 Step 5：老数据没有 companionMode/companionConfig，统一回退到默认。
    companionMode: isCompanionMode(obj.companionMode) ? obj.companionMode : DEFAULT_COMPANION_MODE,
    companionConfig: sanitizeCompanionConfig(obj.companionConfig),
    // 2026-06-09 Step 6.4：老数据初始化为 0 统计。
    companionStats: sanitizeCompanionStats(obj.companionStats),
    // 2026-06-09 Step 6.6：老数据默认单只。
    multiPetStrategy: sanitizeMultiPetStrategy(obj.multiPetStrategy),
    // 2026-06-09 Step 6.4：lastSummonedAt，老数据从 0 开始。
    lastSummonedAt:
      typeof obj.lastSummonedAt === "number" && Number.isFinite(obj.lastSummonedAt) && obj.lastSummonedAt >= 0
        ? Math.floor(obj.lastSummonedAt)
        : 0,
    // 2026-06-09 绘本风：老数据互动数默认 0。真实数据由 PATCH / Electron 桌宠上报写入。
    interactionTotal:
      typeof obj.interactionTotal === "number" && Number.isFinite(obj.interactionTotal) && obj.interactionTotal >= 0
        ? Math.floor(obj.interactionTotal)
        : 0,
    interactionToday:
      typeof obj.interactionToday === "number" && Number.isFinite(obj.interactionToday) && obj.interactionToday >= 0
        ? Math.floor(obj.interactionToday)
        : 0,
    results: Array.isArray(obj.results)
      ? obj.results.filter(
          (r) => r && typeof r === "object" && typeof (r as { imageUrl?: unknown }).imageUrl === "string"
        ).map((r) => {
          const src = r as {
            style?: unknown;
            imageUrl: string;
            videoUrl?: unknown;
            prompt?: unknown;
            createdAt?: unknown;
            feedback?: unknown;
          };
          const out: {
            style: string;
            imageUrl: string;
            videoUrl?: string;
            prompt?: string;
            createdAt?: number;
            feedback?: { tags: string[]; note: string } | null;
          } = {
            style: typeof src.style === "string" ? src.style : "未命名风格",
            imageUrl: src.imageUrl
          };
          if (typeof src.videoUrl === "string" && src.videoUrl.length > 0) {
            out.videoUrl = src.videoUrl;
          }
          if (typeof src.prompt === "string") out.prompt = src.prompt;
          if (typeof src.createdAt === "number" && Number.isFinite(src.createdAt)) {
            out.createdAt = src.createdAt;
          }
          if (
            src.feedback &&
            typeof src.feedback === "object" &&
            Array.isArray((src.feedback as { tags?: unknown }).tags)
          ) {
            const fb = src.feedback as { tags?: unknown; note?: unknown };
            out.feedback = {
              tags: (fb.tags as unknown[]).filter((t) => typeof t === "string") as string[],
              note: typeof fb.note === "string" ? fb.note : ""
            };
          }
          return out;
        })
      : [],
    sourceImage:
      obj.sourceImage && typeof obj.sourceImage === "object"
        ? (obj.sourceImage as PetArchive["sourceImage"])
        : undefined
  };
}

export function getAllArchives(): PetArchive[] {
  ensureDbExists();
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeArchive);
  } catch (error) {
    console.error("Failed to read archives db", error);
    return [];
  }
}

export type SaveArchiveInput = Omit<PetArchive, "id" | "createdAt" | "sourceImage"> & {
  sourceImage?: ArchiveImageInput;
};

function mimeToExt(mimeType: string) {
  const normalized = mimeType.toLowerCase().trim();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  return "jpg";
}

function decodeBase64(input: string) {
  const trimmed = input.trim();
  const parts = trimmed.split("base64,");
  const pure = parts.length > 1 ? parts[1] : parts[0];
  return Buffer.from(pure, "base64");
}

export function getSourceImageFilePath(id: string, ext: string) {
  return path.join(IMAGE_DIR, `${id}.${ext}`);
}

export function getResultImageFilePath(archiveId: string, index: number, ext: string) {
  return path.join(IMAGE_DIR, `${archiveId}-result-${index}.${ext}`);
}

// 解析 archive 里 result[].imageUrl 的本地路径：/api/archive/image/{id}/{index}.{ext}
// 返回 { index, ext } 或 null
// 实现移到文件下方（紧跟 LOCAL_HOSTS 定义）以便复用 LOCAL_HOSTS。

export function getArchiveById(id: string) {
  return getAllArchives().find((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// 2026-06-04 修复：档案里 4 种 style 图原本只存了 OSS URL 字符串，
// 浏览器每次加载都要走阿里云（DNS 17-22s），经常被中途 HMR abort 弄成
// "图片加载失败"。现在 saveArchive 时直接下载到 data/archive-images/，
// 落盘 imageUrl 改成 /api/archive/image/{archiveId}/{index}.{ext} 本地路径。
// ---------------------------------------------------------------------------

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isLocalApiUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (LOCAL_HOSTS.has(url.hostname)) return true;
    if (url.protocol === "data:") return true;
    return false;
  } catch {
    return false;
  }
}

function isRemoteOssUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    if (!url.hostname.endsWith(".aliyuncs.com")) return false;
    if (!url.hostname.includes("dashscope")) return false;
    return true;
  } catch {
    return false;
  }
}

// 解析 archive 里 result[].imageUrl 的本地路径：/api/archive/image/{id}/{index}.{ext}
// 返回 { archiveId, index, ext } 或 null
// 用于 set-image / set-frames 等"从档案投放桌宠"的接口。
export function parseLocalResultImagePath(raw: string) {
  if (typeof raw !== "string" || !raw) return null;
  // 兼容 "/api/archive/image/{id}/{index}.{ext}" 和 "http(s)://host/api/archive/image/{id}/{index}.{ext}"
  const m = raw.match(/^\/api\/archive\/image\/([0-9a-z]+)\/(\d+)\.([a-zA-Z0-9]+)$/);
  if (m) return { archiveId: m[1], index: Number.parseInt(m[2], 10), ext: m[3] };
  try {
    const url = new URL(raw);
    if (!LOCAL_HOSTS.has(url.hostname)) return null;
    const m2 = url.pathname.match(/^\/api\/archive\/image\/([0-9a-z]+)\/(\d+)\.([a-zA-Z0-9]+)$/);
    if (m2) return { archiveId: m2[1], index: Number.parseInt(m2[2], 10), ext: m2[3] };
    return null;
  } catch {
    return null;
  }
}

// 60s 拉一张图（包含 DNS 冷启动），超过 5MB 视为非法直接拒绝。
let _fetchAgent: Agent | null = null;
function getFetchAgent() {
  if (!_fetchAgent) {
    _fetchAgent = new Agent({
      connectTimeout: 60_000,
      headersTimeout: 60_000,
      bodyTimeout: 60_000
    });
  }
  return _fetchAgent;
}
const MAX_RESULT_IMAGE_BYTES = 5 * 1024 * 1024;

function extFromContentType(contentType: string) {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "png";
}

function extFromUrl(rawUrl: string) {
  try {
    const path = new URL(rawUrl).pathname;
    const m = path.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (!m) return "png";
    const ext = m[1].toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
    return "png";
  } catch {
    return "png";
  }
}

async function tryDownloadResultToLocal(
  remoteUrl: string,
  archiveId: string,
  index: number
): Promise<string | null> {
  // 已经在本地 / data URL / 非 OSS 远程 → 不下载，沿用原 URL
  if (isLocalApiUrl(remoteUrl)) return remoteUrl;
  if (remoteUrl.startsWith("/")) return remoteUrl;
  if (!isRemoteOssUrl(remoteUrl)) {
    // 未知白名单的 URL：直接沿用，不冒险下载（避免 SSRF / 被反代）
    return remoteUrl;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await undiciFetch(remoteUrl, {
      dispatcher: getFetchAgent(),
      signal: controller.signal
    });
    if (!response.ok) return null;

    const contentType = String(response.headers.get("content-type") || "");
    if (!/^image\//i.test(contentType)) return null;

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 0 && contentLength > MAX_RESULT_IMAGE_BYTES) {
      console.warn(`[archive] result image too large, skip: ${contentLength}B for ${archiveId}[${index}]`);
      return null;
    }

    // 一次性读全部字节，再校验大小
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_RESULT_IMAGE_BYTES) {
      console.warn(`[archive] result image too large, skip: ${arrayBuffer.byteLength}B`);
      return null;
    }
    const bytes = Buffer.from(arrayBuffer);

    // 推断扩展名（content-type 优先，URL fallback）
    const ext = extFromContentType(contentType) || extFromUrl(remoteUrl);
    const filePath = getResultImageFilePath(archiveId, index, ext);
    fs.writeFileSync(filePath, bytes);
    return `/api/archive/image/${archiveId}/${index}.${ext}`;
  } catch (error) {
    console.warn(
      `[archive] failed to download result image for ${archiveId}[${index}]:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function saveArchive(archive: SaveArchiveInput): PetArchive {
  const archives = getAllArchives();
  const { sourceImage, ...rest } = archive;
  const newArchive: PetArchive = {
    ...rest,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    createdAt: Date.now()
  };

  if (sourceImage?.base64 && sourceImage?.mimeType) {
    const ext = mimeToExt(sourceImage.mimeType);
    const filePath = getSourceImageFilePath(newArchive.id, ext);
    fs.writeFileSync(filePath, decodeBase64(sourceImage.base64));
    newArchive.sourceImage = { mimeType: sourceImage.mimeType, ext };
  }

  // 同步把所有 result 图（同步下载，避免热路径阻塞；这里串行下载 ≤4 张，影响 < 5s）。
  // 下载失败的项保留原 OSS URL 作为兜底，前端能正常展示（只是慢一点）。
  if (Array.isArray(newArchive.results)) {
    newArchive.results = newArchive.results.map((r, idx) => {
      if (typeof r?.imageUrl === "string" && r.imageUrl.length > 0) {
        // 注意：这里用了同步式调用，但 tryDownloadResultToLocal 是 async，
        // 见下方 saveArchiveSync（顶层 wrapper）。这里保持函数同步但调用方
        // 改为 async：见 saveArchive 调整为 await 形式。
      }
      return r;
    });
  }

  archives.unshift(newArchive);
  fs.writeFileSync(DB_FILE, JSON.stringify(archives, null, 2), "utf-8");
  return newArchive;
}

export function deleteArchiveById(id: string) {
  const archives = getAllArchives();
  const index = archives.findIndex((a) => a.id === id);
  if (index < 0) return { ok: false as const, reason: "not_found" as const };

  const removed = archives.splice(index, 1)[0];
  fs.writeFileSync(DB_FILE, JSON.stringify(archives, null, 2), "utf-8");

  if (removed?.sourceImage?.ext) {
    const filePath = getSourceImageFilePath(id, removed.sourceImage.ext);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  // 同步清理 result 图：{id}-result-{0..N}.{png|jpg|webp|gif}
  for (let i = 0; i < (removed?.results?.length ?? 0); i += 1) {
    for (const ext of ["png", "jpg", "webp", "gif"]) {
      const fp = getResultImageFilePath(id, i, ext);
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp);
        } catch {
          /* ignore */
        }
      }
    }
  }

  return { ok: true as const, removed };
}

// ---------------------------------------------------------------------------
// saveArchiveAsync：原 saveArchive 的异步版本，专门负责下载 result 图。
// 推荐所有调用方使用这个，而不是同步版（同步版仅作为"不下载 result 图"回退）。
// ---------------------------------------------------------------------------
export async function saveArchiveAsync(archive: SaveArchiveInput): Promise<PetArchive> {
  const archives = getAllArchives();
  const { sourceImage, ...rest } = archive;
  const newArchive: PetArchive = {
    ...rest,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    createdAt: Date.now()
  };
  // 2026-06-09 Step 6：写入前 normalize 一次，给所有缺省字段补默认值。
  // 避免老调用方（少传 companionStats / multiPetStrategy / lastSummonedAt）写入时丢字段。
  const normalized = normalizeArchive(newArchive);
  // 强制写回 sourceImage（normalizeArchive 会保留原值）
  Object.assign(newArchive, normalized);

  if (sourceImage?.base64 && sourceImage?.mimeType) {
    const ext = mimeToExt(sourceImage.mimeType);
    const filePath = getSourceImageFilePath(newArchive.id, ext);
    fs.writeFileSync(filePath, decodeBase64(sourceImage.base64));
    newArchive.sourceImage = { mimeType: sourceImage.mimeType, ext };
  }

  if (Array.isArray(newArchive.results)) {
    const downloaded: typeof newArchive.results = [];
    for (let i = 0; i < newArchive.results.length; i += 1) {
      const r = newArchive.results[i];
      if (typeof r?.imageUrl !== "string" || r.imageUrl.length === 0) {
        continue;
      }
      const localUrl = await tryDownloadResultToLocal(r.imageUrl, newArchive.id, i);
      downloaded.push({
        style: r.style,
        imageUrl: localUrl ?? r.imageUrl,
        ...(typeof r.videoUrl === "string" && r.videoUrl.length > 0 ? { videoUrl: r.videoUrl } : {}),
        ...(r.prompt ? { prompt: r.prompt } : {}),
        ...(typeof r.createdAt === "number" && Number.isFinite(r.createdAt) ? { createdAt: r.createdAt } : {}),
        ...("feedback" in r ? { feedback: r.feedback ?? null } : {})
      });
    }
    newArchive.results = downloaded;
  }

  archives.unshift(newArchive);
  fs.writeFileSync(DB_FILE, JSON.stringify(archives, null, 2), "utf-8");
  return newArchive;
}
