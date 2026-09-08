import fs from "fs";
import { NextResponse } from "next/server";
import { parseLocalResultImagePath, getResultImageFilePath } from "@/lib/db/archive";
import { route } from "@/lib/server/http.cjs";
import { requireOwnedArchive } from "@/lib/server/guard";

function isSafeArchiveId(id: string) {
  return /^[0-9a-z]+$/i.test(id);
}

function isAllowedRemoteUrl(raw: string) {
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

export const GET = route(
  "GET",
  async (request, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    if (!isSafeArchiveId(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const style = url.searchParams.get("style")?.trim();
    if (!style) {
      return NextResponse.json({ error: "Missing style" }, { status: 400 });
    }

    // 2026-09-08 1A 用户隔离：档案形态图只给档案主人。
    const { archive } = await requireOwnedArchive(request, id);

    const result = archive.results?.find((r) => r.style === style);
    if (!result?.imageUrl) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 尝试读取本地 archive 图片
    const local = parseLocalResultImagePath(result.imageUrl);
    if (local) {
      const filePath = getResultImageFilePath(local.archiveId, local.index, local.ext);
      if (fs.existsSync(filePath)) {
        try {
          const buf = fs.readFileSync(filePath);
          return new NextResponse(buf, {
            status: 200,
            headers: {
              "Content-Type": `image/${local.ext === "jpg" ? "jpeg" : local.ext}`,
              "Cache-Control": "public, max-age=31536000, immutable"
            }
          });
        } catch {
          // fail silent, fallback to fetch
        }
      }
    }

    if (!isAllowedRemoteUrl(result.imageUrl)) {
      return NextResponse.json({ error: "Blocked url" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(result.imageUrl, { signal: controller.signal });
      if (!res.ok) {
        return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
      }
      const buf = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") ?? "image/png";
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fetch failed" },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
);

