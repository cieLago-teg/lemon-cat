import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseLocalResultImagePath, getResultImageFilePath } from "@/lib/db/archive";

function isSafeId(id: string) {
  return /^[0-9a-zA-Z._-]+$/.test(id);
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};

function contentTypeFor(ext: string) {
  return CONTENT_TYPES[ext.toLowerCase()] ?? "image/png";
}

function isAllowedRemoteUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.hostname.endsWith(".aliyuncs.com")) return true;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("url") || "");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // 1) Resolve local://image/<archiveId>-<index>.<ext>
  if (raw.startsWith("local://image/")) {
    const localPath = raw.slice("local://image/".length);
    const dotIndex = localPath.lastIndexOf(".");
    if (dotIndex < 1) {
      return NextResponse.json({ error: "Invalid local path" }, { status: 400 });
    }
    const base = localPath.slice(0, dotIndex);
    const ext = localPath.slice(dotIndex + 1);
    // base is `${archiveId}-${index}` since the fileName is `source.<ext>`,
    // but in our case the fileName is passed without index. We accept
    // either `<archiveId>-<index>` or just `<archiveId>`.
    const dashIndex = base.lastIndexOf("-");
    let archiveId: string;
    let index = 0;
    if (dashIndex > 0 && /^\d+$/.test(base.slice(dashIndex + 1))) {
      archiveId = base.slice(0, dashIndex);
      index = Number.parseInt(base.slice(dashIndex + 1), 10);
    } else {
      archiveId = base;
    }
    if (!isSafeId(archiveId) || !isSafeId(ext)) {
      return NextResponse.json({ error: "Invalid local id" }, { status: 400 });
    }
    const filePath = getResultImageFilePath(archiveId, index, ext);
    if (!fs.existsSync(filePath)) {
      // Fall back to the first image in the archive
      const dir = getResultImageDir(archiveId);
      if (!fs.existsSync(dir)) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
      }
      const files = fs.readdirSync(dir).filter(f => f.startsWith(`${archiveId}-result-`));
      if (files.length === 0) {
        return NextResponse.json({ error: "No images in archive" }, { status: 404 });
      }
      const buf = fs.readFileSync(`${dir}/${files[0]}`);
      const detectedExt = files[0].split(".").pop() || "png";
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": contentTypeFor(detectedExt),
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }
    const buf = fs.readFileSync(filePath);
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  // 1b) Resolve tmp://<filename> (used as a temporary public reference URL
  //     for Wan to fetch via the public tunnel).
  if (raw.startsWith("tmp://")) {
    const fileName = raw.slice("tmp://".length);
    if (!isSafeId(fileName)) {
      return NextResponse.json({ error: "Invalid temp file" }, { status: 400 });
    }
    const tempPath = path.join(process.cwd(), "data", "tmp-anim-refs", fileName);
    if (!fs.existsSync(tempPath)) {
      return NextResponse.json({ error: "Temp file not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(tempPath);
    const ext = fileName.split(".").pop() || "png";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=3600"
      }
    });
  }

  // 2) Direct /api/archive/image/<id>/<idx>.<ext>
  if (raw.startsWith("/api/archive/image/")) {
    const tail = raw.slice("/api/archive/image/".length);
    const parts = tail.split("/");
    if (parts.length !== 2) {
      return NextResponse.json({ error: "Invalid archive path" }, { status: 400 });
    }
    const [id, indexExt] = parts;
    if (!isSafeId(id) || !isSafeId(indexExt)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const dotIndex = indexExt.lastIndexOf(".");
    const index = Number.parseInt(indexExt.slice(0, dotIndex), 10);
    const ext = indexExt.slice(dotIndex + 1);
    if (!Number.isFinite(index) || index < 0) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }
    const filePath = getResultImageFilePath(id, index, ext);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    const buf = fs.readFileSync(filePath);
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  }

  // 3) Remote URL fallback (constrained to whitelisted hosts)
  if (isAllowedRemoteUrl(raw)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(raw, { signal: controller.signal });
      if (!response.ok) {
        return NextResponse.json({ error: `Image download failed (${response.status})` }, { status: 502 });
      }
      const buf = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") || "image/png";
      return new Response(buf, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=300"
        }
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Image download failed" },
        { status: 500 }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return NextResponse.json({ error: "Blocked url" }, { status: 400 });
}

// local helper
function getResultImageDir(archiveId: string) {
  return path.join(process.cwd(), "data", "archive-images");
}
