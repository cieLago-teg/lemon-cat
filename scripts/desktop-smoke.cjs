const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { installDesktop, restoreDesktop } = require('../app-shell/desktop.cjs');
const { logger } = require('../lib/server/logger.cjs');
process.on('uncaughtException',(err)=>{logger.error({err},'desktop smoke uncaught exception');app.exit(1);});
app.setPath('userData',process.env.LEMON_TEST_USER_DATA);
app.on('browser-window-created',(_event,window)=>window.hide());
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  logger.info({mode:process.env.LEMON_TEST_MODE},'desktop smoke app ready');
  const origin = process.env.LEMON_TEST_ORIGIN;
  const mode = process.env.LEMON_TEST_MODE;
  const main = new BrowserWindow({show:false,webPreferences:{preload:path.resolve('app-shell/preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  installDesktop(()=>main,origin,logger);
  if (mode === 'online') {
    await session.defaultSession.cookies.set({url:origin,name:'lemon_session',value:process.env.LEMON_TEST_TOKEN,httpOnly:true,sameSite:'strict'});
    await main.loadURL(origin+'/login');
    const result = await main.webContents.executeJavaScript(`window.lemonCatApp.deployVideo(${JSON.stringify(process.env.LEMON_TEST_VIDEO)})`);
    assert.equal(result.ok,true);
  } else {
    session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_details,callback)=>callback({cancel:true}));
    await restoreDesktop(logger);
  }
  const pet = BrowserWindow.getAllWindows().find((window)=>window !== main);
  assert.ok(pet,'actual transparent pet window must exist');
  const playback = await pet.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
    const video=document.querySelector('video');
    const timeout=setTimeout(()=>reject(new Error('Playback did not advance')),10000);
    function check(){if(video.currentTime>0.1 && video.videoWidth>0 && !video.paused){clearTimeout(timeout);video.removeEventListener('timeupdate',check);resolve({width:video.videoWidth,height:video.videoHeight,loop:video.loop,muted:video.muted,time:video.currentTime});}}
    video.addEventListener('timeupdate',check);check();
  })`);
  assert.equal(playback.width,128); assert.equal(playback.loop,true); assert.equal(playback.muted,true);
  const pixels = await pet.webContents.executeJavaScript(`(()=>{const video=document.querySelector('video');const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0);return {center:Array.from(ctx.getImageData(64,64,1,1).data),corner:Array.from(ctx.getImageData(0,0,1,1).data)};})()`);
  assert.ok(pixels.center[0]>150 && pixels.center[1]<80 && pixels.center[3]>240,'visible opaque foreground required');
  assert.equal(pixels.corner[3],0,'background must stay transparent');
  const screenshot = path.resolve('output/playwright',`desktop-${mode}.png`);
  await fs.mkdir(path.dirname(screenshot),{recursive:true});
  await fs.writeFile(screenshot,(await pet.webContents.capturePage()).toPNG());
  logger.info({mode,playback,screenshot},'desktop smoke passed');
  app.exit(0);
}).catch((err)=>{logger.error({err},'desktop smoke failed');app.exit(1);});
