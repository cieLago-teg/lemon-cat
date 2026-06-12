import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import { getArchiveById, getResultImageFilePath, parseLocalResultImagePath } from "@/lib/db/archive";
import { matteImageBuffer } from "@/lib/pet/rvm-matting.js";

const IMAGE_DIR = path.join(process.cwd(), "data", "archive-images");

function getMattePath(archiveId: string, index: number, ext: string) {
  return path.join(IMAGE_DIR, `${archiveId}-result-${index}-matte.${ext}`);
}

async function ensureMatte(buf: Buffer, archiveId?: string, index?: number, ext?: string): Promise<Buffer> {
  if (archiveId && index != null && ext) {
    const cached = getMattePath(archiveId, index, ext);
    if (fs.existsSync(cached)) {
      const raw = fs.readFileSync(cached);
      if (isPngBuffer(raw)) return raw;
    }
    const matted = await matteImageBuffer(buf);
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, matted);
    return matted;
  }
  return matteImageBuffer(buf);
}

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

function writeStaticConfig() {
  const filePath = path.join(process.cwd(), "desktop-pet-shell", "config.json");
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        mode: "static",
        src: "pet.png"
      },
      null,
      2
    ),
    "utf-8"
  );
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

  return { ok: false as const, reason: "electron_not_installed" as const };
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = (await request.json()) as unknown;
  } catch {
    body = null;
  }

  const pngDataUrl =
    body && typeof body === "object" && "pngDataUrl" in body
      ? String((body as { pngDataUrl?: unknown }).pngDataUrl)
      : "";
  if (pngDataUrl) {
    const buf = parsePngDataUrl(pngDataUrl);
    if (!buf) {
      return NextResponse.json({ error: "Invalid pngDataUrl" }, { status: 400 });
    }
    if (buf.length > 6 * 1024 * 1024) {
      return NextResponse.json({ error: "PNG too large" }, { status: 413 });
    }
    const matted = await ensureMatte(buf);
    const targetPath = path.join(process.cwd(), "desktop-pet-shell", "pet.png");
    fs.writeFileSync(targetPath, matted);
    writeStaticConfig();
    const launched = tryLaunchPetShell();
    return NextResponse.json({ ok: true, shellLaunched: launched.ok, matted: true });
  }

  const imageUrlDirect =
    body && typeof body === "object" && "imageUrl" in body
      ? String((body as { imageUrl?: unknown }).imageUrl)
      : "";
  if (imageUrlDirect) {
    let buf: Buffer | null = null;
    const local = parseLocalResultImagePath(imageUrlDirect);
    if (local) {
      const filePath = getResultImageFilePath(local.archiveId, local.index, local.ext);
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath);
          if (isPngBuffer(raw)) buf = raw;
        } catch {}
      }
    }
    if (!buf) {
      if (!isAllowedRemoteUrl(imageUrlDirect)) {
        return NextResponse.json({ error: "Blocked url", imageUrl: imageUrlDirect }, { status: 400 });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(imageUrlDirect, { signal: controller.signal });
        if (!res.ok) {
          return NextResponse.json({ error: "Fetch failed", status: res.status, imageUrl: imageUrlDirect }, { status: 502 });
        }
        const fetched = Buffer.from(await res.arrayBuffer());
        if (!isPngBuffer(fetched)) {
          return NextResponse.json({ error: "Downloaded content is not a valid PNG", imageUrl: imageUrlDirect }, { status: 502 });
        }
        buf = fetched;
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Fetch failed", imageUrl: imageUrlDirect }, { status: 502 });
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!buf) {
      return NextResponse.json({ error: "Could not resolve pet image", imageUrl: imageUrlDirect }, { status: 502 });
    }
    const matted = local ? await ensureMatte(buf, local.archiveId, local.index, local.ext) : await ensureMatte(buf);
    const targetPath = path.join(process.cwd(), "desktop-pet-shell", "pet.png");
    fs.writeFileSync(targetPath, matted);
    writeStaticConfig();
    const launched = tryLaunchPetShell();
    return NextResponse.json({ ok: true, shellLaunched: launched.ok, source: local ? "local" : "remote", matted: true });
  }

  const archiveId =
    body && typeof body === "object" && "archiveId" in body ? String((body as { archiveId?: unknown }).archiveId) : "";
  const style =
    body && typeof body === "object" && "style" in body ? String((body as { style?: unknown }).style) : "";

  if (!archiveId || !isSafeArchiveId(archiveId)) {
    return NextResponse.json({ error: "Invalid archiveId" }, { status: 400 });
  }
  if (!style) {
    return NextResponse.json({ error: "Missing style" }, { status: 400 });
  }

  const archive = getArchiveById(archiveId);
  if (!archive) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = archive.results?.find((r) => r.style === style);
  if (!result?.imageUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2026-06-06 修复：archive 在回填后 imageUrl 是 "/api/archive/image/{id}/{i}.{ext}" 本地路径，
  // 不再是 OSS 远程 URL。原本强校验 isAllowedRemoteUrl 会直接 400 Blocked url。
  // 新逻辑：先尝试本地读取，失败再走远程 fetch（带 OSS 白名单），两者都失败才报错。
  let buf: Buffer | null = null;

  const local = parseLocalResultImagePath(result.imageUrl);
  if (local && local.archiveId === archiveId) {
    const filePath = getResultImageFilePath(local.archiveId, local.index, local.ext);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath);
        if (isPngBuffer(raw)) {
          buf = raw;
        }
      } catch {
        buf = null;
      }
    }
  }

  if (!buf) {
    if (!isAllowedRemoteUrl(result.imageUrl)) {
      return NextResponse.json(
        { error: "Blocked url", imageUrl: result.imageUrl },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(result.imageUrl, { signal: controller.signal });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Fetch failed", status: res.status, imageUrl: result.imageUrl },
          { status: 502 }
        );
      }
      const contentType = res.headers.get("content-type") ?? "image/png";
      if (!contentType.toLowerCase().includes("png")) {
        return NextResponse.json(
          { error: "Only png is supported for desktop pet currently", imageUrl: result.imageUrl },
          { status: 400 }
        );
      }
      const fetched = Buffer.from(await res.arrayBuffer());
      if (!isPngBuffer(fetched)) {
        return NextResponse.json(
          { error: "Downloaded content is not a valid PNG", imageUrl: result.imageUrl },
          { status: 502 }
        );
      }
      buf = fetched;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Fetch failed", imageUrl: result.imageUrl },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!buf) {
    return NextResponse.json(
      { error: "Could not resolve pet image", imageUrl: result.imageUrl },
      { status: 502 }
    );
  }

  try {
    const matted = local ? await ensureMatte(buf, local.archiveId, local.index, local.ext) : await ensureMatte(buf);
    const targetPath = path.join(process.cwd(), "desktop-pet-shell", "pet.png");
    fs.writeFileSync(targetPath, matted);
    writeStaticConfig();
    const launched = tryLaunchPetShell();
    return NextResponse.json({ ok: true, shellLaunched: launched.ok, source: local ? "local" : "remote", matted: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to write pet.png" },
      { status: 500 }
    );
  }
}
