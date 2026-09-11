const crypto = require('node:crypto');
const { HttpError } = require('./errors.cjs');
const { quotaEnabled } = require('./access-policy.cjs');

async function reserveCreation(client, userId, kind, input) {
  if (!quotaEnabled()) return null;
  let parent;
  if (kind === 'generate' && input.parentJobId) {
    if (!/^[a-f0-9-]{36}$/.test(input.parentJobId)) throw new HttpError(400, '无效的原图识别任务');
    const result = await client.query("SELECT * FROM generation_jobs WHERE id=$1 AND user_id=$2 AND kind='extract' AND state='success'", [input.parentJobId, userId]);
    parent = result.rows[0];
    if (!parent || crypto.createHash('sha256').update(Buffer.from(parent.input.imageBase64, 'base64')).digest('hex') !== input.sourceHash) {
      throw new HttpError(400, '原图与识别任务不匹配，请重新识别');
    }
  }
  if (kind === 'animate') {
    const result = await client.query("SELECT * FROM generation_jobs WHERE user_id=$1 AND kind='generate' AND result->'results' @> $2::jsonb ORDER BY created_at DESC LIMIT 1", [userId, JSON.stringify([{ imageUrl: input.imageUrl }])]);
    parent = result.rows[0];
  }
  if (parent?.creation_id) {
    const used = await client.query('SELECT 1 FROM generation_jobs WHERE creation_id=$1 AND kind=$2', [parent.creation_id, kind]);
    if (!used.rowCount) return parent.creation_id;
  }
  const usage = await client.query("SELECT count(*)::int AS count FROM creations WHERE user_id=$1 AND quota_day=(now() AT TIME ZONE 'UTC')::date", [userId]);
  if (usage.rows[0].count >= 3) throw new HttpError(429, '今天的 3 次创建机会已用完（UTC 零点重置）；额外重生成也占次数');
  const id = crypto.randomUUID();
  await client.query("INSERT INTO creations(id,user_id,quota_day) VALUES($1,$2,(now() AT TIME ZONE 'UTC')::date)", [id, userId]);
  return id;
}
module.exports = { reserveCreation };
