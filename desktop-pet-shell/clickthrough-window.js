function applyClickThroughWindowState(win, enabled) {
  if (!win || typeof win !== "object") return;
  if (typeof win.isDestroyed === "function" && win.isDestroyed()) return;

  if (enabled) {
    win.setIgnoreMouseEvents?.(true, { forward: true });
    win.setFocusable?.(false);
    win.blur?.();
  } else {
    win.setIgnoreMouseEvents?.(false);
    win.setFocusable?.(true);
    if (typeof win.isMinimized === "function" && win.isMinimized()) {
      win.restore?.();
    }
    win.show?.();
    win.moveTop?.();
    win.focus?.();
    win.webContents?.focus?.();
  }

  win.webContents?.send?.("pet:setClickThrough", { enabled });
}

module.exports = {
  applyClickThroughWindowState
};
