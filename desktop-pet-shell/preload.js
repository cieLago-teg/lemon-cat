const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petShell", {
  readConfig: () => ipcRenderer.invoke("pet:readConfig"),
  loadImageDataUrl: (src) => ipcRenderer.invoke("pet:loadImageDataUrl", src),
  getState: () => ipcRenderer.invoke("pet:getState"),
  toggleClickThrough: () => ipcRenderer.send("pet:toggleClickThrough"),
  moveWindow: (dx, dy) => ipcRenderer.send("pet:moveWindow", dx, dy),
  toggleDevTools: () => ipcRenderer.send("pet:toggleDevTools"),
  quit: () => ipcRenderer.send("pet:quit"),
  onClickThroughChanged: (cb) => ipcRenderer.on("pet:setClickThrough", (_, payload) => cb(payload)),
  onReload: (cb) => ipcRenderer.on("pet:reload", cb)
});
