import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import {
  getArchiveById,
  getResultImageFilePath
} from "@/lib/db/archive";

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

  try {
    console.log(`Serving image for id=${id}, index=${index}, ext=${ext}`);
    const filePath = getResultImageFilePath(id, index, ext);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      console.log(`Image not found at ${filePath}`);
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    console.log(`File found, size=${stat.size}`);
    const buffer = await fs.readFile(filePath);
    console.log(`File read, returning response`);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(ext),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": stat.size.toString()
      }
    });
  } catch (err) {
    console.error("Error serving image:", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
