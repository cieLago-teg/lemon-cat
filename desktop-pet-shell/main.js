const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const { applyClickThroughWindowState } = require("./clickthrough-window");

let win = null;
let clickThrough = false;

const dataDir = path.join(__dirname, ".user-data");
const logFile = path.join(dataDir, "pet-shell.log");
function log(...args) {
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`;
    fs.appendFileSync(logFile, line, "utf-8");
  } catch {}
}

app.setPath("userData", dataDir);
app.setPath("sessionData", path.join(dataDir, "session"));
app.setPath("cache", path.join(dataDir, "cache"));
app.setPath("crashDumps", path.join(dataDir, "crashDumps"));
app.commandLine.appendSwitch("user-data-dir", dataDir);
app.commandLine.appendSwitch("disk-cache-dir", path.join(dataDir, "disk-cache"));
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

function setClickThrough(next) {
  clickThrough = next;
  if (!win) return;
  log("click-through", clickThrough ? "on" : "off");
  applyClickThroughWindowState(win, clickThrough);
}

function forceQuit(reason) {
  log("quit", reason);
  try {
    setClickThrough(false);
  } catch {}
  if (win && !win.isDestroyed()) {
    win.destroy();
    win = null;
  }
  setTimeout(() => app.exit(0), 80);
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const size = Math.min(display.workAreaSize.width, display.workAreaSize.height);
  const width = Math.max(166, Math.floor(size * 0.22 * 0.64));
  const height = width;

  win = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workAreaSize.width - width - 24,
    y: display.workArea.y + display.workAreaSize.height - height - 64,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, "index.html"));
  win.on("closed", () => {
    win = null;
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("console", level, message, `(${sourceId}:${line})`);
  });
  win.webContents.on("did-finish-load", () => {
    log("did-finish-load");
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    log("render-process-gone", details);
  });
  win.webContents.on("unresponsive", () => {
    log("unresponsive");
  });
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    log("did-fail-load", errorCode, errorDescription, validatedURL);
  });

  setClickThrough(clickThrough);
}

app.whenReady().then(() => {
  createWindow();

  const tryRegister = (accelerators, handler, name) => {
    for (const acc of accelerators) {
      const ok = globalShortcut.register(acc, handler);
      log("hotkey", name, acc, ok ? "ok" : "fail");
      if (ok) return true;
    }
    return false;
  };

  tryRegister(["Ctrl+Alt+Shift+T"], () => setClickThrough(!clickThrough), "toggle-click-through");
  tryRegister(["Ctrl+Alt+Shift+R"], () => win?.webContents.send("pet:reload"), "reload");
  tryRegister(
    ["Ctrl+Alt+Shift+D"],
    () => {
      if (!win) return;
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: "detach" });
      }
    },
    "devtools"
  );
  tryRegister(["Ctrl+Alt+Shift+Q", "Ctrl+Alt+Shift+X", "Ctrl+Alt+Q"], () => forceQuit("global-shortcut"), "quit");

  ipcMain.handle("pet:getState", () => {
    return { clickThrough };
  });

  ipcMain.handle("pet:readConfig", () => {
    const filePath = path.join(__dirname, "config.json");
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { mode: "static", src: "pet.png" };
    }
  });

  ipcMain.handle("pet:loadImageDataUrl", (event, src) => {
    try {
      const resolved = path.isAbsolute(src) ? src : path.join(__dirname, src);
      const ext = path.extname(resolved).replace(/^\./, "");
      const stat = fs.statSync(resolved);
      const buf = fs.readFileSync(resolved);
      const lower = String(ext || "").toLowerCase();
      const mime =
        lower === "png"
          ? "image/png"
          : lower === "jpg" || lower === "jpeg"
            ? "image/jpeg"
            : lower === "webp"
              ? "image/webp"
              : lower === "gif"
                ? "image/gif"
                : lower === "apng"
                  ? "image/apng"
                  : "application/octet-stream";
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      return { ok: true, dataUrl, resolved, size: stat.size, mtimeMs: stat.mtimeMs };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.on("pet:toggleClickThrough", () => {
    setClickThrough(!clickThrough);
  });

  ipcMain.on("pet:moveWindow", (event, dx, dy) => {
    if (!win) return;
    const [x, y] = win.getPosition();
    win.setPosition(x + dx, y + dy);
  });

  ipcMain.on("pet:toggleDevTools", () => {
    if (!win) return;
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  ipcMain.on("pet:quit", () => {
    forceQuit("ipc");
  });
});

app.on("window-all-closed", () => {
  app.exit(0);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
