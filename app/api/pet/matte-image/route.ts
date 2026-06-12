import fs from "fs";
import { NextResponse } from "next/server";
import { matteImageBuffer } from "@/lib/pet/rvm-matting.js";
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

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    body = null;
  }

  const imageUrl =
    body && typeof body === "object" && "imageUrl" in body
      ? String((body as { imageUrl?: unknown }).imageUrl || "")
      : "";

  if (!imageUrl) {
    return NextResponse.json({ error: "缺少 imageUrl" }, { status: 400 });
  }

  let inputBuffer: Buffer | null = null;

  // 1. 尝试本地路径
  const local = parseLocalResultImagePath(imageUrl);
  if (local) {
    const filePath = getResultImageFilePath(local.archiveId, local.index, local.ext);
    if (fs.existsSync(filePath)) {
      try {
        inputBuffer = fs.readFileSync(filePath);
      } catch {
        inputBuffer = null;
      }
    }
  }

  // 2. 尝试远程 fetch
  if (!inputBuffer) {
    if (!isAllowedRemoteUrl(imageUrl)) {
      return NextResponse.json({ error: "Blocked url" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(imageUrl, { signal: controller.signal });
      if (!response.ok) {
        return NextResponse.json({ error: `图片下载失败 (${response.status})` }, { status: 502 });
      }

      const contentType = String(response.headers.get("content-type") || "");
      if (!contentType.toLowerCase().includes("png")) {
        return NextResponse.json({ error: "当前仅支持 PNG 风格图进行抠像" }, { status: 400 });
      }

      inputBuffer = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "图片下载失败" },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!inputBuffer) {
    return NextResponse.json({ error: "无法读取或下载图片" }, { status: 502 });
  }

  try {
    const outputBuffer = await matteImageBuffer(inputBuffer);
    return NextResponse.json({
      ok: true,
      pngDataUrl: `data:image/png;base64,${outputBuffer.toString("base64")}`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "图片抠像失败" },
      { status: 500 }
    );
  }
}
