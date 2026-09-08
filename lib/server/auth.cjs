const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { database, transaction } = require('./db.cjs');
const { config } = require('./config.cjs');
const { HttpError } = require('./errors.cjs');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const cookieName = 'lemon_session';
function tokenFrom(request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || '';
}
async function viewer(request) {
  const token = tokenFrom(request);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(401, '请先登录');
  const { rows } = await database().query('SELECT u.id,u.email,u.credits FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [digest(token)]);
  if (!rows[0]) throw new HttpError(401, '登录已失效，请重新登录');
  return rows[0];
}
// dev 下 localhost / 127.0.0.1 都视为同源（docs 的启动命令是 127.0.0.1，
// 但用户手输 localhost:3000 也不该被 403 拒绝）。
const DEV_ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
function sameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  // 无 Origin 头 = 非浏览器客户端（curl / Electron），不受 CSRF 约束；
  // 跨站浏览器 POST 一定带 Origin，带错来源直接拒绝。
  const origin = request.headers.get('origin');
  if (origin) {
    const allowed = origin === new URL(config().origin).origin || (!config().production && DEV_ORIGINS.has(origin));
    if (!allowed) throw new HttpError(403, '请求来源不受信任');
  }
  const contentType = request.headers.get('content-type');
  if (contentType && !contentType.startsWith('application/json')) throw new HttpError(415, '请使用 JSON 请求');
}
async function throttle(key, maximum, seconds) {
  const { rows } = await database().query(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,
    expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`, [key, seconds]);
  if (rows[0].count > maximum) throw new HttpError(429, '操作过于频繁，请稍后再试');
}
async function authenticate(body, register) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || password.length<12 || password.length>128) throw new HttpError(400, '请输入有效邮箱及 12—128 位密码');
  await throttle(`login:${digest(email)}`, 8, 900);
  await throttle('auth-global', 100, 60);
  if (register && (!config().invite || body.inviteCode !== config().invite)) throw new HttpError(403, '注册需要有效的内测邀请码');
  let user;
  if (register) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scrypt(password, salt, 64)).toString('hex');
    try {
      const { rows } = await database().query('INSERT INTO users(id,email,password_hash,credits) VALUES($1,$2,$3,$4) RETURNING id,email,credits', [crypto.randomUUID(), email, `${salt}:${hash}`, config().initialCredits]);
      user = rows[0];
    } catch (err) { if (err.code === '23505') throw new HttpError(409, '该邮箱已注册，请登录'); throw err; }
  } else {
    const { rows } = await database().query('SELECT * FROM users WHERE email=$1', [email]);
    const row = rows[0];
    const [salt, expected] = (row?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const actual = await scrypt(password, salt, 64);
    if (!row || !crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'))) throw new HttpError(401, '邮箱或密码不正确');
    user = { id: row.id, email: row.email, credits: row.credits };
  }
  const token = crypto.randomBytes(32).toString('hex');
  await transaction(async (client) => {
    await client.query('DELETE FROM sessions WHERE user_id=$1 AND expires_at<now()', [user.id]);
    await client.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [digest(token), user.id]);
  });
  return { user, cookie: `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${config().origin.startsWith('https:') ? '; Secure' : ''}` };
}
async function logout(request) {
  await database().query('DELETE FROM sessions WHERE token_hash=$1', [digest(tokenFrom(request))]);
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
module.exports = { viewer, sameOrigin, authenticate, logout, throttle, digest };
