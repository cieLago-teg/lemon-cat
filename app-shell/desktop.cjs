const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { trustedOrigin, assetUrl } = require('./desktop-policy.cjs');
let petWindow;
let currentBytes;
let busy = false;
async function showPet(bytes) {
  currentBytes = bytes;
  if (petWindow && !petWindow.isDestroyed()) petWindow.close();
  petWindow = new BrowserWindow({ width: 320, height: 320, frame: false, transparent: true, alwaysOnTop: true, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'pet-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, autoplayPolicy: 'no-user-gesture-required' } });
  petWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  petWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  await petWindow.loadFile(path.join(__dirname, 'pet.html'));
}
function installDesktop(getMain, appUrl, logger) {
  ipcMain.handle('pet:bytes', (event) => {
    if (!petWindow || event.sender !== petWindow.webContents || event.senderFrame !== petWindow.webContents.mainFrame) throw new Error('Untrusted pet renderer');
    return currentBytes;
  });
  ipcMain.handle('pet:deploy', async (event, raw) => {
    let acquired = false;
    try {
      const main = getMain();
      if (!main || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame || !trustedOrigin(event.senderFrame.url, appUrl)) throw new Error('Untrusted IPC sender');
      if (busy) throw new Error('Desktop deployment already in progress');
      const url = assetUrl(raw, appUrl);
      busy = true;
      acquired = true;
      const response = await session.defaultSession.fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
      if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'video/webm' || !response.body) throw new Error(`Private WebM download failed (${response.status})`);
      const chunks = [];
      let size = 0;
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 40 * 1024 * 1024) { await reader.cancel(); throw new Error('Desktop asset exceeds 40MB'); }
        chunks.push(Buffer.from(value));
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length < 4 || bytes.subarray(0,4).toString('hex') !== '1a45dfa3') throw new Error('Invalid WebM content');
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      const directory = path.join(app.getPath('userData'), 'pets');
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, `${hash}.webm`), bytes);
      await fs.writeFile(path.join(directory, 'last.json'), JSON.stringify({ hash }));
      await showPet(bytes);
      logger.info({ bytes: bytes.length, hash }, 'desktop pet opened');
      return { ok: true };
    } catch (err) {
      logger.error({ err }, 'desktop deployment failed');
      return { ok: false, error: '桌宠下载或播放失败，请检查登录状态与本机日志' };
    } finally { if (acquired) busy = false; }
  });
}
async function restoreDesktop(logger) {
  const directory = path.join(app.getPath('userData'), 'pets');
  try {
    const { hash } = JSON.parse(await fs.readFile(path.join(directory, 'last.json'), 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid cached pet manifest');
    const bytes = await fs.readFile(path.join(directory, `${hash}.webm`));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('Cached pet checksum mismatch');
    await showPet(bytes);
  } catch (err) {
    if (err.code !== 'ENOENT') logger.error({ err }, 'cached desktop pet restore failed');
  }
}
module.exports = { installDesktop, restoreDesktop };
