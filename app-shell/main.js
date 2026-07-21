// 2026-07-20：柠檬猫 AI 数字桌宠 - 桌面应用主进程
// 加载线上 Railway 部署的 Next.js 网站（默认）。
// 通过环境变量 LEMON_CAT_URL 可以切换到本地 Next.js standalone。
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// 2026-07-20：实际部署 URL 写到环境变量更灵活。开发期可以改 .env。
const APP_URL =
  process.env.LEMON_CAT_URL || "https://outstanding-purpose-production-8d0c.up.railway.app";

// 2026-07-20：单例锁。避免多次启动开多个窗口。
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    // 用项目主色 amber-50 作为窗口加载前的占位背景
    backgroundColor: "#fef3c7",
    title: "柠檬猫 - AI 数字桌宠",
    autoHideMenuBar: true,
    // 退出确认对话框
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // 允许视频自动播放 + 透明背景（浮动桌宠视频需要）
      autoplayPolicy: "no-user-gesture-required"
    }
  });

  // 2026-07-20：保留用户习惯的最大化状态
  if (process.env.LEMON_CAT_START_MAXIMIZED === "1") {
    mainWindow.maximize();
  }

  // 加载网站
  mainWindow.loadURL(APP_URL);

  // 2026-07-20：外部链接用系统浏览器打开，不要在 app 里跳出去
  // （比如"git clone 完整版桌宠"链接是 GitHub，应该在系统浏览器打开）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 2026-07-20：拦截新窗口导航，也走系统浏览器
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== APP_URL && !url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();

  // macOS：dock 重新点击时恢复窗口
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// 第二次启动时聚焦到现有窗口
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 所有窗口关闭时退出（macOS 除外，macOS 习惯保留 dock）
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
