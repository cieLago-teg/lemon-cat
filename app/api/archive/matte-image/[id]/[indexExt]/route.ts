import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getResultImageFilePath } from "@/lib/db/archive";
import { matteImageBuffer } from "@/lib/pet/rvm-matting.js";

const IMAGE_DIR = path.join(process.cwd(), "data", "archive-images");

function getMatteImageFilePath(archiveId: string, index: number, ext: string) {
  return path.join(IMAGE_DIR, `${archiveId}-result-${index}-matte.${ext}`);
}

function isSafeId(id: string) {
  return /^[0-9a-zA-Z._-]+$/.test(id);
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; indexExt: string }> }
) {
  const { id, indexExt } = await params;
  if (!id || !indexExt) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  if (!isSafeId(id) || !isSafeId(indexExt)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const dotIndex = indexExt.lastIndexOf(".");
  if (dotIndex < 1) {
    return NextResponse.json({ error: "Invalid index.ext" }, { status: 400 });
  }
  const indexStr = indexExt.slice(0, dotIndex);
  const ext = indexExt.slice(dotIndex + 1);
  const index = Number.parseInt(indexStr, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "Invalid index" }, { status: 400 });
  }

  const contentType = CONTENT_TYPES[ext.toLowerCase()] ?? "image/png";

  try {
    const mattePath = getMatteImageFilePath(id, index, ext);

    let body: Uint8Array | null = null;
    let bodyLen = 0;

    const stat = await fs.stat(mattePath).catch(() => null);
    if (stat && stat.isFile()) {
      const buffer = await fs.readFile(mattePath);
      body = new Uint8Array(buffer);
      bodyLen = stat.size;
    } else {
      const originalPath = getResultImageFilePath(id, index, ext);
      const originalStat = await fs.stat(originalPath).catch(() => null);
      if (!originalStat || !originalStat.isFile()) {
        return NextResponse.json({ error: "Original image not found" }, { status: 404 });
      }

      const inputBuffer = await fs.readFile(originalPath);
      const outputBuffer = await matteImageBuffer(inputBuffer);

      await fs.mkdir(path.dirname(mattePath), { recursive: true });
      await fs.writeFile(mattePath, outputBuffer);
      body = new Uint8Array(outputBuffer);
      bodyLen = outputBuffer.length;
    }

    // @ts-expect-error Node.js Buffer → BodyInit 类型兼容
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(bodyLen)
      }
    });
  } catch (err) {
    console.error("Matte image error:", err);
    return NextResponse.json({ error: "Matte processing failed" }, { status: 500 });
  }
}
