import fs from "fs";
import { NextResponse } from "next/server";
import { parseLocalResultImagePath, getResultImageFilePath } from "@/lib/db/archive";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // 尝试读取本地 archive 图片
  const local = parseLocalResultImagePath(raw);
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
}

