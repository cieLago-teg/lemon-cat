// 2026-07-20：preload - 暴露最小化的安全 API 给渲染层。
// 当前用不到复杂 API（网站本身已经有完整功能），但保留扩展点。
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lemonCatApp", {
  deployVideo: (url) => ipcRenderer.invoke('pet:deploy', url),
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
});
