import { parseLocalResultImagePath } from "@/lib/db/archive";
import { isProviderMediaUrl } from "./media-policy.cjs";
import { ownedPet, ownsVideo, ownsImage } from "./pets.cjs";
import { getAnimationTracker } from "@/lib/pet/task-store";
import { ownedAsset } from './assets.cjs';
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

// 本地地址必须先检查档案归属；云端只允许已知供应商 HTTPS 媒体地址。
export async function requireOwnedImage(request: Request, raw: string): Promise<void> {
  if (raw.startsWith('/api/assets/')) {
    const user = await requireUser(request);
    const asset = await ownedAsset(user.id, raw.slice('/api/assets/'.length));
    if (!asset.content_type.startsWith('image/')) throw new HttpError(400, '需要图片素材');
    return;
  }
  const local = parseLocalResultImagePath(raw);
  if (local) {
    await requireOwnedArchive(request, local.archiveId);
    return;
  }
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) && raw.length <= 7 * 1024 * 1024) return;
  if (isProviderMediaUrl(raw) && await ownsImage((await requireUser(request)).id, raw)) return;
  throw new HttpError(400, "参考图地址不受支持，请从自己的宠物档案中选择");
}

export async function requireOwnedArchive(
  request: Request,
  archiveId: string
): Promise<{ user: Viewer; archive: PetArchive; version: number }> {
  const user = await requireUser(request);
  return { user, ...await ownedPet(user.id, archiveId) };
}

export async function requireOwnedVideo(request: Request, url: string) {
  const user = await requireUser(request);
  if (url.startsWith('/api/assets/')) {
    const asset = await ownedAsset(user.id, url.slice('/api/assets/'.length));
    if (!asset.content_type.startsWith('video/')) throw new HttpError(400, '需要视频素材');
    return;
  }
  if (!/^\/pet-videos\/[a-zA-Z0-9_.-]+\.(mp4|webm)$/.test(url) && !isProviderMediaUrl(url)) throw new HttpError(400, "不支持的视频地址");
  if (await ownsVideo(user.id, url) || getAnimationTracker().listAll().some((task) => task.ownerId === user.id && task.videoUrl === url && task.stage === 'Success')) return;
  throw new HttpError(404, "Not found");
}
