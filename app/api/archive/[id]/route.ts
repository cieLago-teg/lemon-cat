import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  deleteArchiveById,
  getAllArchives,
  isCompanionMode as _isCompanionMode,
  PetArchive,
  sanitizeCompanionConfig,
  sanitizeCompanionStats,
  sanitizeMultiPetStrategy
} from "@/lib/db/archive";

const DB_FILE = path.join(process.cwd(), "data", "archives.json");

function isSafeArchiveId(id: string) {
  return /^[0-9a-z]+$/i.test(id);
}

function writeArchives(arr: unknown[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(arr, null, 2), "utf-8");
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeArchiveId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = deleteArchiveById(id);
  if (!result.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, removed: result.removed });
}

// 2026-06-09 Step 3 + Step 4 + Step 5 + Step 6：档案状态/档案编辑/形态操作/桌面陪伴 统一 PATCH 入口。
//
// 接受以下字段（白名单校验）：
//   - deployedAt: number
//   - needsFix: boolean
//   - currentMorphIndex: number
//   - lastSummonedAt: number（Step 6.4）
//   - 8 字段档案：petName / petVibe / customFeatures / species / furColor / eyeColor / earShape / bodyType
//   - 形态操作：{ morph: { style: string, action: "setCurrent" | "delete" | "feedback" | "setVideo", feedback?: { tags: string[], note: string }, videoUrl?: string } }
//   - 桌面陪伴：companionMode: "quiet" | "breathe" | "nest" | "curious" | "dnd" | "active"
//   - 桌面陪伴设置：companionConfig: { position, size, alwaysOnTop, mousePassthrough, nestBackground, autoSummon }
//   - 陪伴统计：companionStats: { totalAttentionMs, interactionCount, mouseFollowCount, lastSessionAt, weeklyPresence }（Step 6.4）
//   - 多宠物策略：multiPetStrategy: "single" | "random" | "rotate"（Step 6.6）
//
// 一个 PATCH 路由统一处理，避免路由爆炸；老 PATCH 调用方保持完全兼容。
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSafeArchiveId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const archives = getAllArchives();
  const idx = archives.findIndex((a) => a.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = archives[idx];
  const updates: Partial<PetArchive> = {};

  // 状态字段
  if (typeof body.deployedAt === "number" && Number.isFinite(body.deployedAt)) {
    updates.deployedAt = body.deployedAt;
  } else if (body.deployedAt === 0) {
    updates.deployedAt = 0;
  }
  if (typeof body.needsFix === "boolean") {
    updates.needsFix = body.needsFix;
  }
  // 2026-06-09 绘本风：标记"最喜欢"
  if (typeof body.hasFav === "boolean") {
    updates.hasFav = body.hasFav;
  }

  // 当前形态
  if (
    typeof body.currentMorphIndex === "number" &&
    Number.isInteger(body.currentMorphIndex) &&
    body.currentMorphIndex >= 0
  ) {
    const max = (target.results ?? []).length;
    if (body.currentMorphIndex < max) {
      updates.currentMorphIndex = body.currentMorphIndex;
    }
  }

  // 2026-06-09 Step 5：陪伴模式（6 种白名单 + 默认值回退）。
  if (_isCompanionMode(body.companionMode)) {
    updates.companionMode = body.companionMode;
  }

  // 2026-06-09 Step 5：6 项基础设置（位置/大小/置顶/鼠标穿透/小窝/自动召唤），
  // sanitizeCompanionConfig 会逐字段白名单 + 默认值回退，恶意 payload 不会污染数据。
  if (body.companionConfig && typeof body.companionConfig === "object") {
    updates.companionConfig = sanitizeCompanionConfig(body.companionConfig);
  }

  // 2026-06-09 Step 6.4：陪伴统计 sanitize（clamp + weeklyPresence 长度 7）。
  if (body.companionStats && typeof body.companionStats === "object") {
    updates.companionStats = sanitizeCompanionStats(body.companionStats);
  }

  // 2026-06-09 Step 6.6：多宠物策略白名单。
  if (body.multiPetStrategy !== undefined) {
    updates.multiPetStrategy = sanitizeMultiPetStrategy(body.multiPetStrategy);
  }

  // 2026-06-09 Step 6.4：lastSummonedAt（>= 0 的整数毫秒时间戳）。
  if (
    typeof body.lastSummonedAt === "number" &&
    Number.isFinite(body.lastSummonedAt) &&
    body.lastSummonedAt >= 0
  ) {
    updates.lastSummonedAt = Math.floor(body.lastSummonedAt);
  }

  // 8 字段档案：白名单 + 类型校验
  const stringFields: (keyof PetArchive)[] = [
    "petName",
    "petVibe",
    "customFeatures",
    "species",
    "furColor",
    "eyeColor",
    "earShape",
    "bodyType"
  ];
  for (const f of stringFields) {
    if (typeof body[f] === "string") {
      (updates as Record<string, unknown>)[f] = body[f];
    }
  }

  // 形态操作
  if (body.morph && typeof body.morph === "object") {
    const op = body.morph as { style?: unknown; action?: unknown; feedback?: unknown; videoUrl?: unknown };
    if (
      typeof op.style === "string" &&
      typeof op.action === "string" &&
      Array.isArray(target.results)
    ) {
      const morphIdx = target.results.findIndex((r) => r.style === op.style);
      if (morphIdx >= 0) {
        const nextResults = target.results.map((r) => ({ ...r }));
        if (op.action === "feedback") {
          // 写入反馈
          if (op.feedback && typeof op.feedback === "object") {
            const fb = op.feedback as { tags?: unknown; note?: unknown };
            nextResults[morphIdx].feedback = {
              tags: Array.isArray(fb.tags)
                ? (fb.tags as unknown[]).filter((t) => typeof t === "string")
                : [],
              note: typeof fb.note === "string" ? fb.note : ""
            };
          } else {
            // 显式清空反馈
            nextResults[morphIdx].feedback = null;
          }
        } else if (op.action === "delete") {
          // 删除该形态（至少保留 1 张，避免空数组）
          if (nextResults.length > 1) {
            nextResults.splice(morphIdx, 1);
            // 如果删的是当前形态或之前的形态，currentMorphIndex 校正
            const current = updates.currentMorphIndex ?? target.currentMorphIndex;
            if (morphIdx < current) {
              updates.currentMorphIndex = Math.max(0, current - 1);
            } else if (morphIdx === current) {
              updates.currentMorphIndex = 0;
            }
          } else {
            return NextResponse.json(
              { error: "至少需要保留 1 张形态，无法删除最后一张" },
              { status: 400 }
            );
          }
        } else if (op.action === "setCurrent") {
          updates.currentMorphIndex = morphIdx;
        } else if (op.action === "setVideo") {
          if (typeof op.videoUrl !== "string" || op.videoUrl.length === 0) {
            return NextResponse.json({ error: "缺少 videoUrl，无法写回动态视频" }, { status: 400 });
          }
          nextResults[morphIdx].videoUrl = op.videoUrl;
        }
        updates.results = nextResults;
      } else {
        return NextResponse.json({ error: `未找到 style 为 ${op.style} 的形态` }, { status: 404 });
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 });
  }

  archives[idx] = { ...target, ...updates };
  writeArchives(archives);

  return NextResponse.json({ archive: archives[idx] });
}
