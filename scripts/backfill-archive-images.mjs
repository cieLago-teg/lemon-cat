// 一次性回填脚本：把现有 data/archives.json 里指向 OSS 远程 URL 的
// results[].imageUrl 全部下载到 data/archive-images/{archiveId}-result-{i}.{ext}，
// 并把 imageUrl 改写为本地 /api/archive/image/... 路径，让所有历史档案秒加载。
//
// 用法：
//   node scripts/backfill-archive-images.mjs
//
// 干完会自动写回 archives.json，重复跑幂等（已经回填过的会跳过）。

import fs from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";

const DB_FILE = path.join(process.cwd(), "data", "archives.json");
const IMAGE_DIR = path.join(process.cwd(), "data", "archive-images");
const MAX_BYTES = 5 * 1024 * 1024;

const agent = new Agent({
  connectTimeout: 60_000,
  headersTimeout: 60_000,
  bodyTimeout: 60_000
});

function isRemoteOss(raw) {
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

function extFromContentType(ct) {
  const lower = String(ct).toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return null;
}

function extFromUrl(rawUrl) {
  try {
    const p = new URL(rawUrl).pathname;
    const m = p.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (!m) return "png";
    const e = m[1].toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) {
      return e === "jpeg" ? "jpg" : e;
    }
    return "png";
  } catch {
    return "png";
  }
}

async function downloadOne(remoteUrl, archiveId, index) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await undiciFetch(remoteUrl, {
      dispatcher: agent,
      signal: controller.signal
    });
    if (!res.ok) {
      console.warn(`  ! HTTP ${res.status} for ${archiveId}[${index}]`);
      return null;
    }
    const ct = String(res.headers.get("content-type") || "");
    if (!/^image\//i.test(ct)) {
      console.warn(`  ! non-image content-type "${ct}" for ${archiveId}[${index}]`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      console.warn(`  ! too large ${buf.byteLength}B for ${archiveId}[${index}]`);
      return null;
    }
    const ext = extFromContentType(ct) || extFromUrl(remoteUrl);
    const filePath = path.join(IMAGE_DIR, `${archiveId}-result-${index}.${ext}`);
    fs.writeFileSync(filePath, buf);
    return `/api/archive/image/${archiveId}/${index}.${ext}`;
  } catch (e) {
    console.warn(
      `  ! fetch failed for ${archiveId}[${index}]: ${e?.message ?? String(e)}`
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`archives.json not found at ${DB_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  let archives;
  try {
    archives = JSON.parse(raw);
  } catch (e) {
    console.error("archives.json 不是合法 JSON:", e);
    process.exit(1);
  }
  if (!Array.isArray(archives)) {
    console.error("archives.json 顶层不是数组");
    process.exit(1);
  }

  let totalChanged = 0;
  let totalSkipped = 0;
  let totalKept = 0;

  for (const a of archives) {
    if (!Array.isArray(a.results)) continue;
    for (let i = 0; i < a.results.length; i += 1) {
      const r = a.results[i];
      if (typeof r?.imageUrl !== "string" || r.imageUrl.length === 0) continue;

      // 已经是本地路径 → 跳过
      if (r.imageUrl.startsWith("/api/archive/image/")) {
        totalSkipped += 1;
        continue;
      }
      // 非 OSS 远程（自管图、data:、base64）→ 不动
      if (!isRemoteOss(r.imageUrl)) {
        totalKept += 1;
        continue;
      }

      process.stdout.write(`[backfill] ${a.id}[${i}] ${r.style}: downloading...`);
      const localUrl = await downloadOne(r.imageUrl, a.id, i);
      if (localUrl) {
        process.stdout.write(` ok → ${localUrl}\n`);
        r.imageUrl = localUrl;
        totalChanged += 1;
      } else {
        process.stdout.write(` skipped\n`);
        totalKept += 1;
      }
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(archives, null, 2), "utf-8");
  console.log("\n=== Backfill done ===");
  console.log(`  changed: ${totalChanged}`);
  console.log(`  skipped (already local): ${totalSkipped}`);
  console.log(`  kept as remote:          ${totalKept}`);
}

main().catch((e) => {
  console.error("Backfill crashed:", e);
  process.exit(1);
});
