const crypto = require('node:crypto');
const { database, transaction } = require('./db.cjs');
const { digest, throttle, hashPassword } = require('./auth.cjs');
const { HttpError } = require('./errors.cjs');
const mail = require('./mail.cjs');
const { budgetPolicy } = require('./access-policy.cjs');

function publicRegistration() { return process.env.PUBLIC_REGISTRATION === 'true'; }
function requirePublicReady() {
  if (!publicRegistration()) throw new HttpError(403, '公开注册尚未开放');
  budgetPolicy();
  mail.mailConfig();
  if (!process.env.APP_ORIGIN?.startsWith('https://') || process.env.ASSET_STORAGE !== 's3') throw new HttpError(503, 'Public access configuration is incomplete');
}
async function requestAccountLink(body, purpose) {
  requirePublicReady();
  if (!['verify','reset'].includes(purpose)) throw new HttpError(400, 'Invalid account action');
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, '请输入有效邮箱及 8—128 位密码');
  await throttle(`mail:${digest(email)}`, 3, 3600);
  await throttle('mail-global-hour', 30, 3600);
  await throttle('mail-global-day', 100, 86400);
  // 验证前不接受注册者设定的密码，避免有人抢注别人的邮箱后等待主人点链接。
  if (purpose === 'verify') await database().query('INSERT INTO users(id,email,password_hash,credits) VALUES($1,$2,$3,0) ON CONFLICT(email) DO NOTHING', [crypto.randomUUID(), email, await hashPassword(crypto.randomBytes(32).toString('hex'))]);
  const token = crypto.randomBytes(32).toString('hex');
  const user = await transaction(async (client) => {
    const { rows } = await client.query('SELECT id,email_verified_at FROM users WHERE email=$1 FOR UPDATE', [email]);
    if (!rows[0] || (purpose === 'verify' ? rows[0].email_verified_at : !rows[0].email_verified_at)) return null;
    await client.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes') ON CONFLICT(user_id,purpose) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,created_at=now()", [digest(token), rows[0].id, purpose]);
    return rows[0].id;
  });
  if (user) await mail.sendAccountMail(email, token, purpose, body.locale === 'zh' ? 'zh' : 'en');
  // 不通过 API 返回邮箱是否存在或验证令牌。
  return { sent: true };
}
async function confirmAccount(body) {
  if (!publicRegistration()) throw new HttpError(403, '公开注册尚未开放');
  if (!/^[a-f0-9]{64}$/.test(body.token || '') || !['verify','reset'].includes(body.purpose)) throw new HttpError(400, '验证链接无效或已过期');
  await throttle('confirm-global', 100, 60);
  const hash = await hashPassword(body.password);
  await transaction(async (client) => {
    const tokenHash = digest(body.token);
    const owner = await client.query('SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now()', [tokenHash, body.purpose]);
    if (!owner.rows[0]) throw new HttpError(400, '验证链接无效或已过期');
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [owner.rows[0].user_id]);
    const used = await client.query('DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id', [tokenHash, body.purpose]);
    if (!used.rows[0]) throw new HttpError(400, '验证链接无效或已过期');
    const userId = used.rows[0].user_id;
    await client.query('UPDATE users SET password_hash=$1,email_verified_at=COALESCE(email_verified_at,now()) WHERE id=$2', [hash, userId]);
    await client.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
    await client.query('DELETE FROM account_tokens WHERE user_id=$1', [userId]);
  });
  return { ok: true };
}
module.exports = { publicRegistration, requirePublicReady, requestAccountLink, confirmAccount };
