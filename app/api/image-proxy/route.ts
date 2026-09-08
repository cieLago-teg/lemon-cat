import fs from "fs";
import { NextResponse } from "next/server";
import { parseLocalResultImagePath, getResultImageFilePath, getArchiveById } from "@/lib/db/archive";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

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

export const GET = route("GET", async (request) => {
  // 2026-09-08 1A 用户隔离：代理必须登录。
  const user = await requireUser(request);
  const url = new URL(request.url);
  const raw = url.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // 尝试读取本地 archive 图片（校验归属）
  const local = parseLocalResultImagePath(raw);
  if (local) {
    const archive = getArchiveById(local.archiveId);
    if (!archive || archive.ownerId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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

  if (!isAllowedRemoteUrl(raw)) {
    return NextResponse.json({ error: "Blocked url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(raw, { signal: controller.signal });
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
});

