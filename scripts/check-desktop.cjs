const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { database, close } = require('../lib/server/db.cjs');
const { putAsset } = require('../lib/server/assets.cjs');
const { logger } = require('../lib/server/logger.cjs');
async function main() {
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Desktop verification is local only');
  const directory = path.resolve('data', `desktop-verification-${crypto.randomUUID()}`);
  fs.mkdirSync(directory, { recursive:true });
  const video = path.join(directory,'synthetic.webm');
  const ffmpeg = require('../lib/pet/rvm-matting.js').resolveFfmpegPath();
  const generated = spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black@0.0:s=128x128:r=8:d=1,format=rgba,drawbox=x=32:y=32:w=64:h=64:color=red:t=fill:replace=1,format=yuva420p','-c:v','libvpx-vp9','-lossless','1','-auto-alt-ref','0',video],{windowsHide:true,encoding:'utf8'});
  if (generated.status !== 0) throw new Error(generated.stderr || 'Synthetic video generation failed');
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await database().query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[userId,`desktop-${userId}@lemoncat.local`,'no-password-login']);
  const videoUrl = await putAsset(userId,fs.readFileSync(video),'video/webm');
  await database().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '10 minutes')",[tokenHash,userId]);
  try {
    const executable = path.resolve('app-shell/node_modules/electron/dist/electron.exe');
    for (const mode of ['online','offline']) {
      const result = spawnSync(executable,[path.resolve('scripts/desktop-smoke.cjs')],{env:{...process.env,LEMON_TEST_ORIGIN:origin,LEMON_TEST_USER_DATA:directory,LEMON_TEST_TOKEN:token,LEMON_TEST_VIDEO:videoUrl,LEMON_TEST_MODE:mode},windowsHide:true,encoding:'utf8',timeout:60000});
      if (result.error) { logger.error({mode,stdout:result.stdout,stderr:result.stderr},'desktop child diagnostic output'); throw result.error; }
      if (result.status !== 0) throw new Error(`Desktop ${mode} verification failed: ${result.stderr}\n${result.stdout}`);
      logger.info({mode,evidence:result.stdout.trim()},'desktop renderer verified');
    }
  } finally {
    await database().query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash]);
  }
}
main().catch((err)=>{logger.error({err},'desktop verification failed');process.exitCode=1;}).finally(close);
