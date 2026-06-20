import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

function hashContent(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function hashFile(filePath: string) {
  try {
    return hashContent(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

function getVideoExtFrom(urlOrContentType: string) {
  const value = String(urlOrContentType || "").toLowerCase();
  if (value.includes("video/webm") || value.includes(".webm")) return ".webm";
  if (value.includes("video/ogg") || value.includes(".ogv")) return ".ogv";
  return ".mp4";
}

async function tryKillPetShell() {
  return new Promise<void>((resolve) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "pet-kill.mjs")], {
      stdio: "ignore",
      detached: true
    });
    child.unref();
    child.on("exit", () => resolve());
    setTimeout(() => resolve(), 3500);
  });
}

async function tryLaunchPetShell() {
  await tryKillPetShell();
  const shellDir = path.join(process.cwd(), "desktop-pet-shell");
  const electronExeWin = path.join(shellDir, "node_modules", "electron", "dist", "electron.exe");
  if (process.platform === "win32" && fs.existsSync(electronExeWin)) {
    const child = spawn(electronExeWin, ["."], {
      cwd: shellDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
    return { ok: true as const };
  }

  const electronCli = path.join(shellDir, "node_modules", "electron", "cli.js");
  if (fs.existsSync(electronCli)) {
    const child = spawn(process.execPath, [electronCli, "."], {
      cwd: shellDir,
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return { ok: true as const };
  }

  return { ok: false as const, reason: "electron_not_installed" as const };
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    body = null;
  }

  const rawVideoUrl =
    body && typeof body === "object" && "videoUrl" in body
      ? String((body as { videoUrl?: unknown }).videoUrl || "")
      : "";
  if (!rawVideoUrl) {
    return NextResponse.json({ error: "缺少 videoUrl" }, { status: 400 });
  }

  const videoUrl = rawVideoUrl.startsWith("/")
    ? new URL(rawVideoUrl, request.url).toString()
    : rawVideoUrl;

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    return NextResponse.json({ error: `视频下载失败 (${videoResponse.status})` }, { status: 400 });
  }

  const contentType = String(videoResponse.headers.get("content-type") || "");
  if (!contentType.startsWith("video/") && !/\.mp4($|\?)/i.test(videoUrl) && !/\.webm($|\?)/i.test(videoUrl)) {
    return NextResponse.json({ error: "只支持 MP4/WebM 视频部署" }, { status: 400 });
  }

  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "视频为空" }, { status: 400 });
  }
  if (bytes.length > 40 * 1024 * 1024) {
    return NextResponse.json({ error: "视频过大，请控制在 40MB 以内" }, { status: 413 });
  }

  const shellDir = path.join(process.cwd(), "desktop-pet-shell");
  const ext = getVideoExtFrom(contentType || videoUrl);
  const fileName = `pet-video${ext}`;
  const videoPath = path.join(shellDir, fileName);
  const newHash = hashContent(bytes);
  const existingHash = hashFile(videoPath);

  if (existingHash === newHash) {
    const launched = await tryLaunchPetShell();
    return NextResponse.json({ ok: true, shellLaunched: launched.ok, fileName, reused: true });
  }

  fs.writeFileSync(videoPath, bytes);
  fs.writeFileSync(
    path.join(shellDir, "config.json"),
    JSON.stringify(
      {
        mode: "video",
        src: fileName
      },
      null,
      2
    ),
    "utf-8"
  );

  const launched = await tryLaunchPetShell();
  return NextResponse.json({ ok: true, shellLaunched: launched.ok, fileName });
}
