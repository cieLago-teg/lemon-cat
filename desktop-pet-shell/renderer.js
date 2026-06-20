const runtimeHelpers = window.PetShellRuntimeHelpers || {};
const createPetShellBridge =
  typeof runtimeHelpers.createPetShellBridge === "function"
    ? runtimeHelpers.createPetShellBridge
    : (api) => api || {};
const normalizeConfig =
  typeof runtimeHelpers.normalizeConfig === "function"
    ? runtimeHelpers.normalizeConfig
    : (raw) => (raw && typeof raw === "object" ? raw : { mode: "static", src: "./pet.png" });
const getRuntimeScriptUrls =
  typeof runtimeHelpers.getRuntimeScriptUrls === "function" ? runtimeHelpers.getRuntimeScriptUrls : () => [];

const shellBridge = createPetShellBridge(window.petShell);
const bridgeAvailable = Boolean(window.petShell);

const petImg = document.getElementById("pet");
const petVideo = document.getElementById("pet-video");
const live2dCanvas = document.getElementById("live2d-canvas");
const hud = document.getElementById("hud");

function showHud(text, ms) {
  if (!hud) return;
  hud.textContent = text;
  hud.classList.add("visible");
  window.clearTimeout(showHud._timer);
  const duration = Number.isFinite(ms) ? ms : 2200;
  showHud._timer = window.setTimeout(() => hud.classList.remove("visible"), duration);
}

petImg?.addEventListener("error", () => {
  showHud("图片资源加载失败");
});

petVideo?.addEventListener("error", () => {
  showHud("视频资源加载失败");
});

function padNumber(value, digits) {
  const raw = String(value);
  if (raw.length >= digits) return raw;
  return "0".repeat(digits - raw.length) + raw;
}

function buildFrameUrl(baseUrl, index, digits, ext) {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalized}${padNumber(index, digits)}.${ext}`;
}

let frameTimer = null;
let framesPlaying = true;
let activeFramesConfig = null;
let clickThroughEnabled = false;
const loadedRuntimeScripts = new Set();

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (loadedRuntimeScripts.has(src)) {
      resolve();
      return;
    }

    const selector = `script[data-runtime-src="${src}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        loadedRuntimeScripts.add(src);
        resolve();
        return;
      }
      existing.addEventListener(
        "load",
        () => {
          existing.dataset.loaded = "true";
          loadedRuntimeScripts.add(src);
          resolve();
        },
        { once: true }
      );
      existing.addEventListener(
        "error",
        () => reject(new Error(`script load failed: ${src}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.runtimeSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        loadedRuntimeScripts.add(src);
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`script load failed: ${src}`)),
      { once: true }
    );
    document.body.appendChild(script);
  });
}

async function ensureRuntimeForMode(mode) {
  const urls = getRuntimeScriptUrls(mode);
  for (const src of urls) {
    await loadScriptOnce(src);
  }
}

function startFrames(config) {
  if (frameTimer) {
    window.clearInterval(frameTimer);
    frameTimer = null;
  }
  activeFramesConfig = config;
  if (!framesPlaying) {
    return;
  }
  let i = 0;
  const interval = Math.max(10, Math.floor(1000 / Math.max(1, config.fps)));
  frameTimer = window.setInterval(() => {
    const idx = config.startIndex + (i % config.count);
    petImg.src = buildFrameUrl(config.baseUrl, idx, config.digits, config.ext);
    i += 1;
  }, interval);
}

function stopFrames() {
  if (frameTimer) {
    window.clearInterval(frameTimer);
    frameTimer = null;
  }
}

async function toggleFramesPlaying() {
  if (petVideo && petVideo.style.display !== "none" && petVideo.src) {
    if (petVideo.paused) {
      try {
        await petVideo.play();
        showHud("播放");
      } catch (error) {
        showHud(`播放失败：${error instanceof Error ? error.message : "unknown"}`, 3200);
      }
    } else {
      petVideo.pause();
      showHud("暂停");
    }
    return;
  }
  framesPlaying = !framesPlaying;
  if (!activeFramesConfig) return;
  if (framesPlaying) {
    startFrames(activeFramesConfig);
    showHud("播放");
  } else {
    stopFrames();
    showHud("暂停");
  }
}

let pixiApp = null;
let currentLive2dModel = null;

async function startLive2D(config) {
  petImg.style.display = "none";
  live2dCanvas.style.display = "block";
  stopFrames();

  if (!window.PIXI?.live2d?.Live2DModel) {
    showHud("Live2D 初始化失败：缺少 PIXI.live2d", 5200);
    return;
  }

  if (!pixiApp) {
    pixiApp = new PIXI.Application({
      view: live2dCanvas,
      autoStart: true,
      backgroundAlpha: 0,
      resizeTo: window
    });
  }

  if (currentLive2dModel) {
    pixiApp.stage.removeChild(currentLive2dModel);
    currentLive2dModel.destroy();
    currentLive2dModel = null;
  }

  try {
    const model = await PIXI.live2d.Live2DModel.from(config.baseUrl);
    currentLive2dModel = model;
    pixiApp.stage.addChild(model);

    try {
      await applyCustomTextures(model, config.baseUrl);
    } catch (textureErr) {
      showHud(
        "换皮纹理加载失败（已回退到默认皮肤）：" +
          (textureErr instanceof Error ? textureErr.message : "unknown"),
        4200
      );
    }

    const scaleX = innerWidth / model.width;
    const scaleY = innerHeight / model.height;
    model.scale.set(Math.min(scaleX, scaleY) * 0.9);
    model.x = (innerWidth - model.width * model.scale.x) / 2;
    model.y = (innerHeight - model.height * model.scale.y) / 2;

    model.interactive = true;
    model.on("pointerdown", () => {
      try {
        model.internalModel.motionManager.expressionManager?.setRandomExpression();
        model.motion("TapBody");
      } catch {}
    });
  } catch (e) {
    showHud("Live2D加载失败: " + (e instanceof Error ? e.message : "unknown"), 5200);
  }
}

async function applyCustomTextures(model, baseUrl) {
  if (!model?.internalModel?.textures || !Array.isArray(model.internalModel.textures)) {
    return;
  }

  const lastSlash = Math.max(baseUrl.lastIndexOf("/"), baseUrl.lastIndexOf("\\"));
  const modelDir = lastSlash >= 0 ? baseUrl.slice(0, lastSlash + 1) : "./";
  const normalizedDir = modelDir.startsWith("./") || modelDir.startsWith("/") ? modelDir : `./${modelDir}`;

  const textureList = model.internalModel.textures;
  let replaced = 0;
  for (let i = 0; i < textureList.length; i += 1) {
    const customUrl = `${normalizedDir}pet-cat.1024/custom_${padNumber(i, 2)}.png`;
    let exists = false;
    try {
      const resp = await fetch(customUrl, { method: "HEAD", cache: "no-store" });
      exists = resp.ok;
    } catch (_) {
      exists = false;
    }
    if (!exists) continue;
    try {
      const newTex = await PIXI.Texture.from(customUrl);
      const slot = textureList[i];
      if (slot && typeof slot === "object") {
        if ("texture" in slot) {
          slot.texture = newTex;
        } else if (typeof slot.destroy === "function") {
          try { slot.destroy(); } catch (_) { /* ignore */ }
          textureList[i] = newTex;
        }
        replaced += 1;
      }
    } catch (e) {
      console.warn(`[live2d] custom texture ${i} failed:`, e);
    }
  }
  if (replaced > 0) {
    showHud(`已加载 ${replaced} 张换皮纹理`, 2200);
  }
}

// 幂等保护：避免重复的 pet:reload / 调试 IPC 把 boot() 串联起来执行。
// Trae IDE 内嵌的调试面板偶尔会因为 IPC 风暴触发多次 pet:reload，
// 我们用 inFlight + cooldown 把并发和短时间内重复都吃掉。
let bootInFlight = false;
let lastBootAt = 0;
const BOOT_COOLDOWN_MS = 800;

async function boot() {
  const now = Date.now();
  if (bootInFlight) {
    showHud("重载中，跳过重复请求", 900);
    return;
  }
  if (now - lastBootAt < BOOT_COOLDOWN_MS) {
    showHud("重载冷却中", 600);
    return;
  }
  bootInFlight = true;
  lastBootAt = now;
  try {
    await bootInner();
  } finally {
    bootInFlight = false;
  }
}

async function bootInner() {
  const config = normalizeConfig(await shellBridge.readConfig());

  if (config.mode === "live2d") {
    try {
      await ensureRuntimeForMode(config.mode);
    } catch (error) {
      showHud(`Live2D 运行时加载失败：${error instanceof Error ? error.message : String(error)}`, 5200);
      return;
    }
    await startLive2D(config);
    showHud("Live2D");
  } else {
    live2dCanvas.style.display = "none";
    petImg.style.display = "none";
    if (petVideo) {
      petVideo.pause();
      petVideo.style.display = "none";
      petVideo.removeAttribute("src");
      petVideo.load();
    }
    if (pixiApp && currentLive2dModel) {
      pixiApp.stage.removeChild(currentLive2dModel);
      currentLive2dModel.destroy();
      currentLive2dModel = null;
    }
    
    if (config.mode === "frames") {
      petImg.style.display = "block";
      startFrames(config);
      showHud("Frames");
    } else if (config.mode === "video") {
      stopFrames();
      activeFramesConfig = null;
      if (petVideo) {
        petVideo.style.display = "block";
        petVideo.src = config.src;
        petVideo.currentTime = 0;
        try {
          await petVideo.play();
        } catch {}
      }
      showHud("Video");
    } else {
      stopFrames();
      activeFramesConfig = null;
      petImg.style.display = "block";
      if (config.src.startsWith("http://") || config.src.startsWith("https://") || config.src.startsWith("data:") || config.src.startsWith("blob:") || config.src.startsWith("file://")) {
        petImg.removeAttribute("src");
        petImg.src = config.src;
        showHud(config.mode === "gif" ? "GIF/WebP" : "Static");
      } else {
        const result = await shellBridge.loadImageDataUrl(config.src.replace(/^\.\//, ""));
        if (result?.ok && result.dataUrl) {
          petImg.removeAttribute("src");
          petImg.src = result.dataUrl;
          const ts = result.mtimeMs ? new Date(result.mtimeMs).toLocaleTimeString() : "";
          showHud(`${config.mode === "gif" ? "GIF/WebP" : "Static"} · ${result.size || 0}B · ${ts}`);
        } else {
          petImg.removeAttribute("src");
          petImg.src = config.src;
          const reason = result?.error || "unknown";
          if (!bridgeAvailable && reason === "petShell_unavailable") {
            showHud("未检测到桌宠桥接，已回退到直接加载静态资源", 3200);
          } else {
            showHud(`图片加载失败：${reason}`);
          }
        }
      }
    }
  }

  const state = await shellBridge.getState();
  clickThroughEnabled = Boolean(state.clickThrough);
  showHud(state.clickThrough ? "Click-through: ON (Ctrl+Alt+Shift+T)" : "Click-through: OFF (Ctrl+Alt+Shift+T)", 5200);
}

shellBridge.onClickThroughChanged((payload) => {
  clickThroughEnabled = Boolean(payload.enabled);
  showHud(payload.enabled ? "Click-through: ON (Ctrl+Alt+Shift+T)" : "Click-through: OFF (Ctrl+Alt+Shift+T)", 5200);
});

shellBridge.onReload(() => {
  void boot();
});

window.addEventListener("keydown", (e) => {
  if (e.key === "t" && (e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey) {
    shellBridge.toggleClickThrough();
  }
  if (e.key === "Escape") {
    shellBridge.quit();
  }
  if (e.key === " " && activeFramesConfig) {
    e.preventDefault();
    toggleFramesPlaying();
  }
});

function quitPet() {
  try {
    shellBridge.quit();
  } catch {}
  try {
    window.close();
  } catch {}
}

petImg?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  quitPet();
});
petVideo?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  quitPet();
});
live2dCanvas?.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  quitPet();
});

window.addEventListener("pointerdown", (e) => {
  if (clickThroughEnabled) {
    clickThroughEnabled = false;
    shellBridge.toggleClickThrough();
    showHud("已解除穿透（现在可以正常操作了）", 2600);
  }
});

void boot();
