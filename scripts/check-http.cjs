const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { database, close } = require('../lib/server/db.cjs');
const { putAsset } = require('../lib/server/assets.cjs');
const { logger } = require('../lib/server/logger.cjs');
const base = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8xkAAAAASUVORK5CYII=';
let checks = 0;
async function api(method, route, cookie, body, headers = {}) {
  return fetch(base+route, { method, headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type':'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
}
function status(response, expected) { assert.equal(response.status,expected); checks++; }
async function main() {
  assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'HTTP verification runs only against local services');
  status(await api('GET','/api/archive'),401);
  status(await api('POST','/api/auth/register',null,{email:`too-short-${crypto.randomUUID()}@lemoncat.local`,password:'aB3!xyz',inviteCode:process.env.REGISTRATION_CODE}),400);
  const accounts = [];
  for (let i=0;i<2;i++) {
    const response = await api('POST','/api/auth/register',null,{email:`verify-${crypto.randomUUID()}@lemoncat.local`,password:i === 0 ? 'Cat@2026' : crypto.randomBytes(24).toString('hex'),inviteCode:process.env.REGISTRATION_CODE});
    status(response,200);
    accounts.push({ cookie: response.headers.get('set-cookie').split(';')[0], user: (await response.json()).user });
  }
  const [a,b] = accounts;
  const response = await api('POST','/api/archive',a.cookie,{petName:'HTTP verification fixture',ownerId:b.user.id,results:[{style:'test',imageUrl:'data:image/png;base64,'+png}],sourceImage:{base64:png,mimeType:'image/png'}});
  status(response,200);
  const { archive } = await response.json();
  assert.equal(archive.ownerId,a.user.id); checks++;
  status(await api('GET',`/api/archive/${archive.id}`,a.cookie),200);
  status(await api('GET',`/api/archive/${archive.id}`,b.cookie),404);
  status(await api('DELETE',`/api/archive/${archive.id}`,b.cookie),404);
  status(await api('PATCH',`/api/archive/${archive.id}`,b.cookie,{petName:'intrusion'}),404);
  status(await api('POST','/api/pet/animate',b.cookie,{imageUrl:`/api/archive/image/${archive.id}/0.png`},{'idempotency-key':crypto.randomUUID()}),404);
  const source = await api('GET',`/api/archive/image/${archive.id}`,a.cookie);
  status(source,200); assert.equal(source.headers.get('cache-control'),'private, no-store'); checks++;
  status(await api('GET',`/api/archive/image/${archive.id}`,b.cookie),404);
  const video = await putAsset(a.user.id,Buffer.from('1a45dfa3000102030405','hex'),'video/webm');
  const range = await api('GET',video,a.cookie,undefined,{range:'bytes=0-3'});
  status(range,206); assert.equal(Buffer.from(await range.arrayBuffer()).toString('hex'),'1a45dfa3'); checks++;
  status(await api('GET',video,b.cookie),404);
  status(await api('GET',video),401);
  status(await api('GET',video,a.cookie,undefined,{range:'bytes=100-200'}),416);
  status(await api('POST','/api/pet/set-video',b.cookie,{videoUrl:video}),404);
  const legacyName = `verification-${crypto.randomUUID()}.webm`;
  const legacyUrl = `/pet-videos/${legacyName}`;
  fs.mkdirSync(path.join('public','pet-videos'),{recursive:true});
  fs.writeFileSync(path.join('public','pet-videos',legacyName),Buffer.from('1a45dfa3000102030405','hex'),{flag:'wx'});
  await database().query("UPDATE pets SET data=jsonb_set(data,'{results,0,videoUrl}',$1::jsonb) WHERE id=$2 AND user_id=$3",[JSON.stringify(legacyUrl),archive.id,a.user.id]);
  status(await api('POST','/api/pet/set-video',b.cookie,{videoUrl:legacyUrl}),404);
  const migrated = await api('POST','/api/pet/set-video',a.cookie,{videoUrl:legacyUrl});
  status(migrated,200); assert.equal((await migrated.json()).playbackUrl,video); checks++;
  status(await api('POST','/api/pet/set-video',a.cookie,{videoUrl:'http://127.0.0.1:55432/private'}),400);
  status(await api('POST','/api/extract',a.cookie,{imageBase64:png,mimeType:'image/png'},{'idempotency-key':crypto.randomUUID()}),402);
  status(await api('PATCH',`/api/archive/${archive.id}`,a.cookie,{petName:'cross-site'},{origin:'https://evil.invalid'}),403);
  status(await api('GET','/pet-videos/unauthorized-fixture.webm'),401);
  const jobId = crypto.randomUUID();
  await database().query("INSERT INTO generation_jobs(id,user_id,kind,idempotency_key,input_hash,input,state,result,request_id,cost) VALUES($1,$2,'animate',$3,'fixture','{}','success',$4,'http-verification',0)",[jobId,a.user.id,crypto.randomUUID(),{videoUrl:video}]);
  const own = await api('GET',`/api/jobs/${jobId}`,a.cookie); status(own,200);
  assert.equal((await own.json()).task.videoUrl,video); checks++;
  status(await api('GET',`/api/jobs/${jobId}`,b.cookie),404);
  const alien = await api('GET',`/api/pet/animation-status?taskId=${jobId}`,b.cookie);
  assert.equal((await alien.json()).task.missing,true); checks++;
  status(await api('POST','/api/auth/logout',a.cookie,{}),200);
  status(await api('GET','/api/archive',a.cookie),401);
  if (process.env.LEMON_BROWSER_STATE) {
    const file = path.resolve(process.env.LEMON_BROWSER_STATE);
    const allowed = path.resolve('data') + path.sep;
    if (!file.startsWith(allowed)) throw new Error('Browser test state must stay inside project data directory');
    const imageUrl = await putAsset(b.user.id,Buffer.from(png,'base64'),'image/png');
    await database().query("INSERT INTO generation_jobs(id,user_id,kind,idempotency_key,input_hash,input,state,result,request_id,cost) VALUES($1,$2,'generate',$3,'fixture','{}','success',$4,'browser-verification',0)",[crypto.randomUUID(),b.user.id,crypto.randomUUID(),{results:[{style:'合成测试素材',imageUrl}]}]);
    await database().query("UPDATE sessions SET expires_at=now()+interval '15 minutes' WHERE user_id=$1",[b.user.id]);
    fs.writeFileSync(file,JSON.stringify({cookies:[{name:'lemon_session',value:b.cookie.split('=')[1],domain:new URL(base).hostname,path:'/',expires:Math.floor(Date.now()/1000)+900,httpOnly:true,secure:false,sameSite:'Strict'}],origins:[]}),{flag:'wx',mode:0o600});
    logger.info({file,expiresInMinutes:15},'isolated browser test state created; contains only test session');
  }
  logger.info({ checks, fixtureArchiveId: archive.id, noPaidCalls: true }, 'HTTP isolation and asset verification passed');
}
main().catch((err) => { logger.error({err,checks},'HTTP verification failed'); process.exitCode=1; }).finally(close);
