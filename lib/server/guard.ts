import { getArchiveById } from "@/lib/db/archive";
import type { PetArchive } from "@/lib/db/archive-types";
import { viewer } from "./auth.cjs";
import { HttpError } from "./errors.cjs";

// 2026-09-08 1A 用户隔离：所有 /api/* 路由的统一入口检查。
// requireUser：未登录 → 401；requireOwnedArchive：不是本人档案 → 404（不泄露存在性）。
// 用法：在 route() 包装的 handler 里 await，抛出的 HttpError 会被 route() 映射成 JSON 响应。

export type Viewer = { id: string; email: string; credits: number };

export async function requireUser(request: Request): Promise<Viewer> {
  return viewer(request) as Promise<Viewer>;
}

export async function requireOwnedArchive(
  request: Request,
  archiveId: string
): Promise<{ user: Viewer; archive: PetArchive }> {
  const user = await requireUser(request);
  const archive = getArchiveById(archiveId);
  if (!archive || archive.ownerId !== user.id) {
    throw new HttpError(404, "Not found");
  }
  return { user, archive };
}
