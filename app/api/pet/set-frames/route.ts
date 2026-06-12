import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

function isPngBuffer(buf: Buffer) {
  if (buf.length < 8) return false;
  return buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

function parsePngDataUrl(input: string) {
  const raw = input.trim();
  const prefix = "data:image/png;base64,";
  const base64 = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
  if (!base64) return null;
  const buf = Buffer.from(base64, "base64");
  if (!isPngBuffer(buf)) return null;
  return buf;
}

function tryKillPetShell() {
  try {
    spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "pet-kill.mjs")], {
      stdio: "ignore"
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

  return { ok: false as const };
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    body = null;
  }

  const frames =
    body && typeof body === "object" && "frames" in body ? (body as { frames?: unknown }).frames : null;
  const fps =
    body && typeof body === "object" && "fps" in body ? Number((body as { fps?: unknown }).fps) : 12;
  const digits =
    body && typeof body === "object" && "digits" in body ? Number((body as { digits?: unknown }).digits) : 3;

  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 36) {
    return NextResponse.json({ error: "Invalid frames" }, { status: 400 });
  }

  const safeFps = Number.isFinite(fps) ? Math.max(1, Math.min(60, Math.floor(fps))) : 12;
  const safeDigits = Number.isFinite(digits) ? Math.max(1, Math.min(6, Math.floor(digits))) : 3;

  const shellDir = path.join(process.cwd(), "desktop-pet-shell");
  const framesDir = path.join(shellDir, "frames");
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  let totalBytes = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const raw = frames[i];
    const buf = typeof raw === "string" ? parsePngDataUrl(raw) : null;
    if (!buf) {
      return NextResponse.json({ error: `Invalid frame at index ${i}` }, { status: 400 });
    }
    totalBytes += buf.length;
    if (totalBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Frames too large" }, { status: 413 });
    }
    const name = `${String(i).padStart(safeDigits, "0")}.png`;
    fs.writeFileSync(path.join(framesDir, name), buf);
  }

  const configPath = path.join(shellDir, "config.json");
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        mode: "frames",
        baseUrl: "./frames",
        startIndex: 0,
        count: frames.length,
        digits: safeDigits,
        fps: safeFps,
        ext: "png"
      },
      null,
      2
    ),
    "utf-8"
  );

  const launched = tryLaunchPetShell();
  return NextResponse.json({ ok: true, shellLaunched: launched.ok });
}
