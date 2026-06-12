(function initRuntimeHelpers(globalObject) {
  const LIVE2D_RUNTIME_SCRIPTS = [
    "./lib/live2dcubismcore.min.js",
    "./lib/pixi.min.js",
    "./lib/pixi-live2d-display.min.js"
  ];

  function normalizeSrc(src) {
    const value = String(src || "").trim();
    if (!value) return "./pet.png";
    if (
      value.startsWith("data:") ||
      value.startsWith("blob:") ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("file://") ||
      value.startsWith("./") ||
      value.startsWith("../") ||
      value.startsWith("/")
    ) {
      return value;
    }
    return `./${value}`;
  }

  function normalizeConfig(raw) {
    const cfg = raw && typeof raw === "object" ? raw : {};
    const mode =
      cfg.mode === "frames" ||
      cfg.mode === "gif" ||
      cfg.mode === "video" ||
      cfg.mode === "static" ||
      cfg.mode === "live2d"
        ? cfg.mode
        : "static";

    if (mode === "live2d") {
      return {
        mode,
        baseUrl: String(cfg.baseUrl || "./models/shizuku/runtime/shizuku.model3.json")
      };
    }

    if (mode === "frames") {
      return {
        mode,
        baseUrl: String(cfg.baseUrl || "./frames"),
        startIndex: Number.isFinite(cfg.startIndex) ? cfg.startIndex : 0,
        count: Number.isFinite(cfg.count) ? cfg.count : 24,
        digits: Number.isFinite(cfg.digits) ? cfg.digits : 3,
        fps: Number.isFinite(cfg.fps) ? cfg.fps : 12,
        ext: String(cfg.ext || "png").replace(/^\./, "")
      };
    }

    return {
      mode,
      src: normalizeSrc(cfg.src || "pet.png")
    };
  }

  function getRuntimeScriptUrls(mode) {
    return mode === "live2d" ? [...LIVE2D_RUNTIME_SCRIPTS] : [];
  }

  function createPetShellBridge(rawApi) {
    const api = rawApi && typeof rawApi === "object" ? rawApi : {};

    return {
      readConfig: async () => {
        try {
          if (typeof api.readConfig === "function") {
            const result = await api.readConfig();
            return normalizeConfig(result);
          }
        } catch {}
        return normalizeConfig(null);
      },
      loadImageDataUrl: async (src) => {
        try {
          if (typeof api.loadImageDataUrl === "function") {
            return await api.loadImageDataUrl(src);
          }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
        return { ok: false, error: "petShell_unavailable" };
      },
      getState: async () => {
        try {
          if (typeof api.getState === "function") {
            const result = await api.getState();
            return {
              clickThrough: Boolean(result && typeof result === "object" && result.clickThrough)
            };
          }
        } catch {}
        return { clickThrough: false };
      },
      toggleClickThrough: () => {
        try {
          if (typeof api.toggleClickThrough === "function") api.toggleClickThrough();
        } catch {}
      },
      moveWindow: (dx, dy) => {
        try {
          if (typeof api.moveWindow === "function") api.moveWindow(dx, dy);
        } catch {}
      },
      toggleDevTools: () => {
        try {
          if (typeof api.toggleDevTools === "function") api.toggleDevTools();
        } catch {}
      },
      quit: () => {
        try {
          if (typeof api.quit === "function") api.quit();
        } catch {}
      },
      onClickThroughChanged: (cb) => {
        try {
          if (typeof api.onClickThroughChanged === "function") {
            api.onClickThroughChanged(cb);
            return true;
          }
        } catch {}
        return false;
      },
      onReload: (cb) => {
        try {
          if (typeof api.onReload === "function") {
            api.onReload(cb);
            return true;
          }
        } catch {}
        return false;
      }
    };
  }

  const exported = {
    createPetShellBridge,
    getRuntimeScriptUrls,
    normalizeConfig,
    normalizeSrc
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }

  if (globalObject && typeof globalObject === "object") {
    globalObject.PetShellRuntimeHelpers = exported;
  }
})(typeof window !== "undefined" ? window : globalThis);
