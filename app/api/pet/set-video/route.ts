import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import { resolveLocalAssetUrl } from "@/lib/pet/local-url.js";

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

function tryKillPetShell() {
  try {
    spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "pet-kill.mjs")], {
      stdio: "ignore",
      windowsHide: true
    });
  } catch {}
}

function tryLaunchPetShell() {
  tryKillPetShell();
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

  // 2026-07-15 Step 6.2：检测 Railway 部署环境。在 Railway 上没有桌面环境，
  // Electron 永远起不来，且容器内文件系统不持久（重启即丢），写本地文件
  // 没意义。直接透传 videoUrl 给前端，让前端在网页里用 <video> 循环播放。
  // —— 关键：Railway 检测必须**先于**本地 fetch，否则会先触发 SSL 错误。
  const isRailway = Boolean(process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_ENVIRONMENT);
  if (isRailway) {
    // rawVideoUrl 是相对路径（如 /pet-videos/xxx.mp4），拼成完整公网 URL 返回。
    // 公网域名从 RAILWAY_PUBLIC_DOMAIN 拿（不依赖 request.url，因为反向代理
    // 会把它转成 https://localhost:8080，反而误导）。
    const publicHost = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.PUBLIC_BASE_URL || "";
    const playbackUrl = rawVideoUrl.startsWith("/")
      ? `${publicHost}${rawVideoUrl}`
      : rawVideoUrl;
    return NextResponse.json({
      ok: true,
      shellLaunched: false,
      fileName: null,
      playbackUrl,
      mode: "browser"
    });
  }

  // 本地 dev 环境：把相对路径拼成 http://127.0.0.1:PORT 走内网 fetch。
  // 严禁用 new URL(rawVideoUrl, request.url)，因为本地 request.url 也是
  // http://localhost:PORT，但万一外部代理注入 https 头就会触发 SSL 错误。
  const videoUrl = resolveLocalAssetUrl(rawVideoUrl, request.url);

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
    fs.writeFileSync(path.join(shellDir, "config.json"), JSON.stringify({ mode: "video", src: fileName }, null, 2));
    const launched = tryLaunchPetShell();
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

  const launched = tryLaunchPetShell();
  return NextResponse.json({ ok: true, shellLaunched: launched.ok, fileName });
}
