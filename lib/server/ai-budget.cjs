const { transaction } = require('./db.cjs');
const { HttpError } = require('./errors.cjs');
const { logger } = require('./logger.cjs');
const { budgetEnabled, callLimit } = require('./access-policy.cjs');

async function reserveCall(job, slot, profile) {
  if (!budgetEnabled()) return;
  let policy;
  try { policy = callLimit(profile); }
  catch (err) { err.safeToRefund = true; throw err; }
  const { monthlyMicros, amount } = policy;
  await transaction(async (client) => {
    // 全站锁而非用户锁：多个 worker 同时到达最后一笔预算也只能一个成功。
    await client.query('SELECT pg_advisory_xact_lock(17401741)');
    const lease = await client.query("SELECT id FROM generation_jobs WHERE id=$1 AND locked_by=$2 AND lease_until>now() AND state='submitting' FOR UPDATE", [job.id, job.locked_by]);
    if (!lease.rowCount) throw new Error('Worker lease lost before paid call');
    const previous = await client.query('SELECT 1 FROM ai_reservations WHERE job_id=$1 AND slot=$2', [job.id, slot]);
    if (previous.rowCount) throw new Error('Paid call already reserved; reconcile before resubmitting');
    const total = await client.query("SELECT COALESCE(sum(reserved_micros),0)::text AS total FROM ai_reservations WHERE period=date_trunc('month',now() AT TIME ZONE 'UTC')::date OR settled_micros IS NULL", []);
    if (BigInt(total.rows[0].total) + BigInt(amount) > BigInt(monthlyMicros)) {
      throw Object.assign(new HttpError(429, '全站本月 AI 预算已用完；已保存的宠物仍可使用'), { safeToRefund: true });
    }
    await client.query("INSERT INTO ai_reservations(job_id,slot,user_id,profile,reserved_micros,period) VALUES($1,$2,$3,$4,$5,date_trunc('month',now() AT TIME ZONE 'UTC')::date)", [job.id, slot, job.user_id, profile, amount]);
    logger.info({ jobId: job.id, slot, profile, reservedMicros: amount }, 'AI call budget reserved');
  });
}

// 不自动释放失败/超时预留：失败不代表供应商未收费。实际账单核销另行审计。
module.exports = { reserveCall };
