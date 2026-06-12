# APNG Desktop Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal APNG export-and-deploy path so AI-generated pet videos can be converted to transparent APNG and deployed into the Electron desktop pet shell without replacing the existing video pipeline.

**Architecture:** Keep `MiniMax/Wan -> video -> matting webm` unchanged as the generation backbone. Add a new FFmpeg-based APNG exporter that converts the already-generated transparent video into a looping APNG, then add one new API route and one new Motion Lab deploy mode that writes `desktop-pet-shell/config.json` with an `animated_image` mode rendered through the existing `<img>` path in Electron.

**Tech Stack:** Next.js App Router, React 19, Electron, Node.js built-in `node:test`, FFmpeg, existing `lib/pet/rvm-matting.js` helper.

---

## Scope

- In scope:
  - Export transparent APNG from an existing local transparent video.
  - Deploy APNG into `desktop-pet-shell`.
  - Add a dedicated Motion Lab deploy option for APNG.
  - Add regression tests around exporter, shell config normalization, and Motion Lab integration.
- Out of scope:
  - Replacing the existing `video` preview flow with APNG preview.
  - Generating APNG automatically during `/api/pet/animate`.
  - Adding Python `rembg` or any new non-Node runtime dependency.

## File Structure

- Create: `lib/pet/apng-export.js`
  - Responsibility: Convert an existing local video file into a looping APNG using FFmpeg only.
- Create: `lib/pet/apng-export.test.cjs`
  - Responsibility: Verify APNG export produces a valid animated PNG and uses the expected FFmpeg flags.
- Create: `app/api/pet/set-apng/route.ts`
  - Responsibility: Download or resolve the current generated video, export APNG, write it into `desktop-pet-shell`, update shell config, restart Electron shell.
- Create: `lib/pet/apng-integration.test.cjs`
  - Responsibility: Source-level regression coverage for `set-apng` route wiring and Motion Lab APNG deploy branch.
- Modify: `app/motion-lab/page.tsx`
  - Responsibility: Add APNG deploy mode and button copy, call `/api/pet/set-apng`.
- Modify: `desktop-pet-shell/runtime-helpers.js`
  - Responsibility: Normalize new `animated_image` shell mode.
- Modify: `desktop-pet-shell/runtime-helpers.test.cjs`
  - Responsibility: Lock the new shell mode contract.
- Modify: `desktop-pet-shell/renderer.js`
  - Responsibility: Show `animated_image` through the existing image renderer with an APNG-specific HUD label.

## Design Notes

- Prefer FFmpeg APNG muxing over a new package:
  - The repo already ships FFmpeg and has helper logic in `lib/pet/rvm-matting.js`.
  - Keeping export inside Node avoids a second runtime and keeps Windows setup simpler.
- Export from transparent WebM, not from the original MP4:
  - The current matting pipeline already solves alpha quality.
  - Reusing the matted asset avoids maintaining a second background-removal path.
- Introduce `animated_image` instead of overloading `static` or `gif`:
  - `static` would work visually but is misleading in config and HUD.
  - `gif` would work mechanically but makes future maintenance confusing.

## Task 1: Add FFmpeg APNG Export Utility

**Files:**
- Create: `lib/pet/apng-export.js`
- Test: `lib/pet/apng-export.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { exportApngFromVideo } = require("./apng-export.js");

test("exportApngFromVideo writes a valid animated PNG file", async () => {
  const fixture = path.join(process.cwd(), "public", "pet-videos", "e2e-real", "matted.webm");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pet-apng-"));
  const output = path.join(tmp, "pet-animation.png");

  const result = await exportApngFromVideo(fixture, output, { fps: 12, loop: 0 });

  assert.equal(result, output);
  assert.ok(fs.existsSync(output), "output file should exist");

  const bytes = fs.readFileSync(output);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.notEqual(bytes.indexOf(Buffer.from("acTL")), -1, "APNG must contain acTL chunk");
});

test("exportApngFromVideo source wires ffmpeg with looped APNG settings", () => {
  const source = fs.readFileSync(path.join(__dirname, "apng-export.js"), "utf8");
  assert.match(source, /-plays/);
  assert.match(source, /"-plays",\s*"0"|'-plays',\s*'0'/);
  assert.match(source, /fps=/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/pet/apng-export.test.cjs`

Expected: FAIL with `Cannot find module './apng-export.js'`

- [ ] **Step 3: Write minimal implementation**

```js
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveFfmpegPath } = require("./rvm-matting.js");

async function exportApngFromVideo(inputPath, outputPath, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error("输入视频不存在: " + inputPath);
  }

  const fps = Number.isFinite(options.fps) ? Math.max(1, Math.min(30, Math.floor(options.fps))) : 12;
  const loop = Number.isFinite(options.loop) ? Math.max(0, Math.floor(options.loop)) : 0;
  const ffmpegPath = resolveFfmpegPath();
  const outputDir = path.dirname(outputPath);
  const tempDir = fs.mkdtempSync(path.join(outputDir, "temp_apng_"));

  try {
    const tempDirPosix = tempDir.replace(/\\/g, "/");
    const inputPathPosix = inputPath.replace(/\\/g, "/");
    const outputPathPosix = outputPath.replace(/\\/g, "/");

    const extract = spawnSync(
      ffmpegPath,
      ["-y", "-i", inputPathPosix, "-vf", `fps=${fps}`, `${tempDirPosix}/%04d.png`],
      { stdio: "pipe" }
    );
    if (extract.error || extract.status !== 0) {
      throw new Error(`FFmpeg extract error: ${extract.stderr ? extract.stderr.toString() : "Unknown error"}`);
    }

    const encode = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        `${tempDirPosix}/%04d.png`,
        "-plays",
        String(loop),
        "-f",
        "apng",
        outputPathPosix
      ],
      { stdio: "pipe" }
    );
    if (encode.error || encode.status !== 0) {
      throw new Error(`FFmpeg encode error: ${encode.stderr ? encode.stderr.toString() : "Unknown error"}`);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error("APNG 导出失败: 未生成输出文件");
    }

    return outputPath;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  exportApngFromVideo
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test lib/pet/apng-export.test.cjs`

Expected: PASS with `2 tests`

- [ ] **Step 5: Commit**

```bash
git add lib/pet/apng-export.js lib/pet/apng-export.test.cjs
git commit -m "feat: add ffmpeg apng exporter"
```

## Task 2: Teach The Electron Shell About `animated_image`

**Files:**
- Modify: `desktop-pet-shell/runtime-helpers.js`
- Modify: `desktop-pet-shell/runtime-helpers.test.cjs`
- Modify: `desktop-pet-shell/renderer.js`

- [ ] **Step 1: Write the failing test**

Append this test to `desktop-pet-shell/runtime-helpers.test.cjs`:

```js
test("normalizeConfig keeps animated_image mode distinct from static mode", () => {
  assert.deepEqual(normalizeConfig({ mode: "animated_image", src: "pet-animation.png" }), {
    mode: "animated_image",
    src: "./pet-animation.png"
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test desktop-pet-shell/runtime-helpers.test.cjs`

Expected: FAIL because `normalizeConfig()` falls back to `static`

- [ ] **Step 3: Write minimal implementation**

In `desktop-pet-shell/runtime-helpers.js`, update the mode whitelist:

```js
const mode =
  cfg.mode === "frames" ||
  cfg.mode === "gif" ||
  cfg.mode === "video" ||
  cfg.mode === "static" ||
  cfg.mode === "animated_image" ||
  cfg.mode === "live2d"
    ? cfg.mode
    : "static";
```

In `desktop-pet-shell/renderer.js`, keep the `<img>` path but improve the HUD label:

```js
const imageLikeMode =
  config.mode === "static" ||
  config.mode === "gif" ||
  config.mode === "animated_image";

// ...
} else if (config.mode === "video") {
  // unchanged video branch
} else if (imageLikeMode) {
  stopFrames();
  activeFramesConfig = null;
  petImg.style.display = "block";
  const hudLabel =
    config.mode === "animated_image"
      ? "APNG"
      : config.mode === "gif"
        ? "GIF/WebP"
        : "Static";

  if (
    config.src.startsWith("http://") ||
    config.src.startsWith("https://") ||
    config.src.startsWith("data:") ||
    config.src.startsWith("blob:") ||
    config.src.startsWith("file://")
  ) {
    petImg.removeAttribute("src");
    petImg.src = config.src;
    showHud(hudLabel);
  } else {
    const result = await shellBridge.loadImageDataUrl(config.src.replace(/^\.\//, ""));
    if (result?.ok && result.dataUrl) {
      petImg.removeAttribute("src");
      petImg.src = result.dataUrl;
      const ts = result.mtimeMs ? new Date(result.mtimeMs).toLocaleTimeString() : "";
      showHud(`${hudLabel} · ${result.size || 0}B · ${ts}`);
    } else {
      petImg.removeAttribute("src");
      petImg.src = config.src;
      showHud(`图片加载失败：${result?.error || "unknown"}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test desktop-pet-shell/runtime-helpers.test.cjs`

Expected: PASS with the new `animated_image` assertion green

- [ ] **Step 5: Commit**

```bash
git add desktop-pet-shell/runtime-helpers.js desktop-pet-shell/runtime-helpers.test.cjs desktop-pet-shell/renderer.js
git commit -m "feat: support animated image mode in pet shell"
```

## Task 3: Add `/api/pet/set-apng` Route

**Files:**
- Create: `app/api/pet/set-apng/route.ts`
- Modify: `lib/pet/apng-export.test.cjs`
- Test: `lib/pet/apng-export.test.cjs`

- [ ] **Step 1: Write the failing integration test**

Append this source-level regression test to `lib/pet/apng-export.test.cjs`:

```js
test("set-apng route exports APNG and writes animated_image config", () => {
  const routeSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "api", "pet", "set-apng", "route.ts"),
    "utf8"
  );

  assert.match(routeSource, /exportApngFromVideo/);
  assert.match(routeSource, /pet-animation\.png/);
  assert.match(routeSource, /mode:\s*"animated_image"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/pet/apng-export.test.cjs`

Expected: FAIL because `app/api/pet/set-apng/route.ts` does not exist

- [ ] **Step 3: Write minimal implementation**

Create `app/api/pet/set-apng/route.ts`:

```ts
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import { exportApngFromVideo } from "@/lib/pet/apng-export.js";

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

  const rawVideoUrl =
    body && typeof body === "object" && "videoUrl" in body
      ? String((body as { videoUrl?: unknown }).videoUrl || "")
      : "";

  if (!rawVideoUrl) {
    return NextResponse.json({ error: "缺少 videoUrl" }, { status: 400 });
  }

  const videoUrl = rawVideoUrl.startsWith("/") ? new URL(rawVideoUrl, request.url).toString() : rawVideoUrl;
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    return NextResponse.json({ error: `视频下载失败 (${videoResponse.status})` }, { status: 400 });
  }

  const bytes = Buffer.from(await videoResponse.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "视频为空" }, { status: 400 });
  }
  if (bytes.length > 40 * 1024 * 1024) {
    return NextResponse.json({ error: "视频过大，请控制在 40MB 以内" }, { status: 413 });
  }

  const shellDir = path.join(process.cwd(), "desktop-pet-shell");
  const tempVideoPath = path.join(shellDir, "pet-source.webm");
  const apngPath = path.join(shellDir, "pet-animation.png");
  fs.writeFileSync(tempVideoPath, bytes);

  await exportApngFromVideo(tempVideoPath, apngPath, { fps: 12, loop: 0 });

  fs.writeFileSync(
    path.join(shellDir, "config.json"),
    JSON.stringify(
      {
        mode: "animated_image",
        src: "pet-animation.png"
      },
      null,
      2
    ),
    "utf-8"
  );

  const launched = tryLaunchPetShell();
  return NextResponse.json({ ok: true, shellLaunched: launched.ok, fileName: "pet-animation.png" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/pet/apng-export.test.cjs`

Expected: PASS with the new route integration assertion green

- [ ] **Step 5: Commit**

```bash
git add app/api/pet/set-apng/route.ts lib/pet/apng-export.test.cjs
git commit -m "feat: add apng deployment route"
```

## Task 4: Add APNG Deploy Mode To Motion Lab

**Files:**
- Create: `lib/pet/apng-integration.test.cjs`
- Modify: `app/motion-lab/page.tsx`
- Test: `lib/pet/apng-integration.test.cjs`

- [ ] **Step 1: Write the failing integration test**

Create `lib/pet/apng-integration.test.cjs`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("motion-lab exposes an APNG deploy mode and calls set-apng", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "motion-lab", "page.tsx"),
    "utf8"
  );

  assert.match(source, /type DeployMode = "static" \| "float" \| "video" \| "apng" \| "live2d"/);
  assert.match(source, /\/api\/pet\/set-apng/);
  assert.match(source, /deployMode === "apng"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/pet/apng-integration.test.cjs`

Expected: FAIL because `DeployMode` does not include `apng`

- [ ] **Step 3: Write minimal implementation**

In `app/motion-lab/page.tsx`, extend the union:

```ts
type DeployMode = "static" | "float" | "video" | "apng" | "live2d";
```

Add an APNG branch next to the current video deploy branch:

```ts
    } else if (deployMode === "apng") {
      try {
        if (!animatedUrl || animatedMediaType !== "video") {
          throw new Error("请先生成一段 AI 动画视频，再导出 APNG 桌宠");
        }
        const res = await fetch("/api/pet/set-apng", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoUrl: animatedUrl })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? `投放失败 (${res.status})`);
        setNotice(
          data?.shellLaunched
            ? "已投放到桌面（APNG）：桌宠壳已响应，请点“重载”"
            : "已写入 APNG：如未自动弹出窗口，请运行 npm run dev:pet-shell"
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "投放失败");
      } finally {
        setPetSetting(false);
      }
```

Add the APNG option card in the deploy-mode selector copy:

```tsx
<button
  type="button"
  onClick={() => setDeployMode("apng")}
  className={/* keep the same card styling pattern as other modes */}
>
  <div className="text-sm font-semibold">APNG 桌宠</div>
  <div className={`mt-1 text-xs ${deployMode === "apng" ? "text-white/80" : "text-slate-500"}`}>
    透明边缘更稳，适合小尺寸循环桌宠
  </div>
</button>
```

Update the helper copy where the page explains the selected mode:

```tsx
{deployMode === "static"
  ? "静态 PNG"
  : deployMode === "float"
    ? "前端合成呼吸帧"
    : deployMode === "video"
      ? "透明视频桌宠"
      : deployMode === "apng"
        ? "透明 APNG 桌宠"
        : "Live2D 桌宠"}
```

Add the guard note near the action button:

```tsx
{deployMode === "apng" && (!animatedUrl || animatedMediaType !== "video") ? (
  <div className="mt-2 text-xs text-amber-600">APNG 需要先生成一段 AI 动画视频作为导出源。</div>
) : null}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test lib/pet/apng-integration.test.cjs`

Expected: PASS

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors in `app/motion-lab/page.tsx`

- [ ] **Step 5: Commit**

```bash
git add app/motion-lab/page.tsx lib/pet/apng-integration.test.cjs
git commit -m "feat: add apng desktop deploy mode"
```

## Task 5: Manual Verification On Windows

**Files:**
- Verify: `app/api/pet/set-apng/route.ts`
- Verify: `desktop-pet-shell/config.json`
- Verify: `desktop-pet-shell/pet-animation.png`

- [ ] **Step 1: Start the app and shell prerequisites**

Run: `npm run dev:trae:all`

Expected: Next dev server starts and the shell can be launched from API routes.

- [ ] **Step 2: Generate or reuse one matted animation**

In Motion Lab:

```text
1. 选择一个已有档案图
2. 生成 AI 动画，等待出现可播放视频
3. 选择“APNG 桌宠”
4. 点击投放
```

Expected:
- API returns `ok: true`
- `desktop-pet-shell/pet-animation.png` exists
- `desktop-pet-shell/config.json` contains `"mode": "animated_image"`

- [ ] **Step 3: Verify the Electron window renders transparency correctly**

Check:

```text
- 桌宠窗口透明背景正常
- APNG 自动循环
- 毛发/耳尖边缘没有黑边或白边
- 鼠标穿透开关仍然可用
```

Expected: The APNG pet behaves like the existing static pet, but animates through the `<img>` path.

- [ ] **Step 4: Run the focused regression suite**

Run: `node --test lib/pet/apng-export.test.cjs desktop-pet-shell/runtime-helpers.test.cjs lib/pet/apng-integration.test.cjs`

Expected: PASS

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/pet/set-apng/route.ts app/motion-lab/page.tsx desktop-pet-shell/runtime-helpers.js desktop-pet-shell/runtime-helpers.test.cjs desktop-pet-shell/renderer.js lib/pet/apng-export.js lib/pet/apng-export.test.cjs lib/pet/apng-integration.test.cjs
git commit -m "feat: deploy desktop pets as apng"
```

## Self-Review

- Spec coverage:
  - APNG exporter: covered by Task 1.
  - Electron shell support: covered by Task 2.
  - Next API route for deployment: covered by Task 3.
  - Motion Lab UI wiring: covered by Task 4.
  - Windows manual verification: covered by Task 5.
- Placeholder scan:
  - No `TODO`, `TBD`, or implicit “write tests later” steps remain.
- Type consistency:
  - `animated_image` is the config mode everywhere.
  - `/api/pet/set-apng` is the single route name everywhere.
  - `DeployMode` adds only `"apng"`; existing values stay unchanged.

## Follow-Up After This Plan

- If this MVP feels good in real desktop use, the next plan should automate APNG generation inside `app/api/pet/animate/route.ts` and return both `videoUrl` and `apngUrl`.
- If file size becomes a problem, add a second pass that downscales to `256x256` or uses lower export FPS before writing `pet-animation.png`.

Plan complete and saved to `docs/superpowers/plans/2026-06-04-apng-desktop-pet.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
