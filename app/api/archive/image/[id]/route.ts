import fs from "fs";
import { getSourceImageFilePath } from "@/lib/db/archive";
import { route } from "@/lib/server/http.cjs";
import { requireOwnedArchive } from "@/lib/server/guard";
import { ownedAsset, readAsset } from '@/lib/server/assets.cjs';

export const runtime = "nodejs";

export const GET = route(
  "GET",
  async (request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    if (!/^[0-9a-z]+$/i.test(id)) {
      return new Response("Invalid id", { status: 400 });
    }
    // 2026-09-08 1A 用户隔离：源图只给档案主人。
    const { archive, user } = await requireOwnedArchive(request, id);
    if (!archive.sourceImage) {
      return new Response("Not found", { status: 404 });
    }
    if (archive.sourceImage.assetUrl) {
      const asset = await ownedAsset(user.id, archive.sourceImage.assetUrl.slice('/api/assets/'.length));
      return new Response(new Uint8Array(await readAsset(asset)), { headers: { 'content-type': asset.content_type } });
    }
    const filePath = getSourceImageFilePath(id, archive.sourceImage.ext);
    if (!fs.existsSync(filePath)) {
      return new Response("Not found", { status: 404 });
    }
    const buf = fs.readFileSync(filePath);
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": archive.sourceImage.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }
);
