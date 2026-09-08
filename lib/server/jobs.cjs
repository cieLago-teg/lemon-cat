const crypto = require('node:crypto');
const { database, transaction } = require('./db.cjs');
const { HttpError } = require('./errors.cjs');
const { logger } = require('./logger.cjs');
const COSTS = { extract: 1, generate: 4, animate: 10 };

async function enqueue(userId, kind, key, input, requestId) {
  if (!COSTS[kind] || !/^[a-zA-Z0-9_-]{16,100}$/.test(key || '')) throw new HttpError(400, '缺少有效的 Idempotency-Key');
  const encoded = JSON.stringify(input);
  if (Buffer.byteLength(encoded) > 8 * 1024 * 1024) throw new HttpError(413, '请求内容过大');
  const hash = crypto.createHash('sha256').update(kind + encoded).digest('hex');
  return transaction(async (client) => {
    // 锁定用户行让同一账号的幂等检查、额度预留与建单成为一个原子操作。
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const previous = await client.query('SELECT * FROM generation_jobs WHERE user_id=$1 AND idempotency_key=$2', [userId, key]);
    if (previous.rows[0]) {
      if (previous.rows[0].input_hash !== hash) throw new HttpError(409, '同一请求标识不能用于不同内容');
      return previous.rows[0];
    }
    const unfinished = await client.query("SELECT * FROM generation_jobs WHERE user_id=$1 AND input_hash=$2 AND state IN ('queued','submitting','polling','materializing','needs_review') ORDER BY created_at LIMIT 1", [userId,hash]);
    if (unfinished.rows[0]) return unfinished.rows[0];
    const active = await client.query("SELECT count(*)::int AS count FROM generation_jobs WHERE user_id=$1 AND state IN ('queued','submitting','polling','materializing')", [userId]);
    if (active.rows[0].count >= 3) throw new HttpError(429,'已有三个任务在处理，请先等待结果');
    const cost = COSTS[kind];
    const balance = await client.query('UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits >= $1 RETURNING credits', [cost, userId]);
    if (!balance.rowCount) throw new HttpError(402, '内测生成额度不足，请联系维护者；未调用模型');
    const id = crypto.randomUUID();
    const created = await client.query('INSERT INTO generation_jobs(id,user_id,kind,idempotency_key,input_hash,input,request_id,cost) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [id,userId,kind,key,hash,input,requestId,cost]);
    await client.query("INSERT INTO usage_ledger(id,user_id,job_id,delta,reason) VALUES($1,$2,$3,$4,'reserve')", [crypto.randomUUID(),userId,id,-cost]);
    logger.info({ jobId: id, userId, kind, requestId, cost }, 'generation queued');
    return created.rows[0];
  });
}
async function getJob(userId, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  const { rows } = await database().query('SELECT * FROM generation_jobs WHERE id=$1 AND user_id=$2', [id,userId]);
  return rows[0] || null;
}
async function listJobs(userId) {
  const { rows } = await database().query("SELECT * FROM generation_jobs WHERE user_id=$1 AND state NOT IN ('success','failed') ORDER BY created_at DESC LIMIT 20", [userId]);
  return rows;
}
function publicJob(job) {
  const terminal = ['failed','needs_review'].includes(job.state);
  return { taskId: job.id, kind: job.kind, stage: job.state === 'success' ? 'Success' : terminal ? 'Failure' : 'Processing',
    percent: job.state === 'success' || terminal ? 100 : job.state === 'materializing' ? 90 : job.upstream_id ? 60 : 5,
    message: job.state === 'needs_review' ? '提交结果待核对，请勿重复生成；额度暂时保留' : job.state === 'materializing' ? '正在保存和处理成品' : job.state === 'queued' ? '已排队，等待 worker' : job.state === 'success' ? '生成完成' : terminal ? '生成失败，额度已退回' : '生成处理中',
    videoUrl: job.result?.videoUrl || null, result: job.result, error: job.error, state: job.state, updatedAt: new Date(job.updated_at).getTime() };
}
async function claim(workerId) {
  return transaction(async (client) => {
    // 提交中断且没有上游 ID 的任务不能再次提交；无法证明模型未收费。
    await client.query("UPDATE generation_jobs SET state='needs_review',error='提交结果不确定，请联系维护者核对，勿重复生成',locked_by=NULL,lease_until=NULL,updated_at=now() WHERE state='submitting' AND lease_until<now()");
    const { rows } = await client.query("SELECT * FROM generation_jobs WHERE state IN ('queued','polling','materializing') AND next_run<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if (!rows[0]) return null;
    const job = rows[0];
    const updated = await client.query("UPDATE generation_jobs SET locked_by=$1,lease_until=now()+interval '2 minutes',state=CASE WHEN state='queued' THEN 'submitting' ELSE state END,attempts=attempts+1,updated_at=now() WHERE id=$2 RETURNING *", [workerId,job.id]);
    return updated.rows[0];
  });
}
async function transition(job, state, extra = {}) {
  return transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM generation_jobs WHERE id=$1 AND locked_by=$2 AND lease_until>now() FOR UPDATE', [job.id, job.locked_by]);
    if (!rows[0]) throw new Error('Worker lease lost; result not committed');
    await client.query('UPDATE generation_jobs SET state=$1,upstream_id=COALESCE($2,upstream_id),result=COALESCE($3,result),error=$4,next_run=now()+$5*interval \'1 second\',locked_by=NULL,lease_until=NULL,updated_at=now() WHERE id=$6', [state,extra.upstreamId || null,extra.result || null,extra.error || null,extra.delay || 0,job.id]);
    if (state === 'failed') {
      const refund = await client.query("INSERT INTO usage_ledger(id,user_id,job_id,delta,reason) VALUES($1,$2,$3,$4,'refund') ON CONFLICT(job_id,reason) DO NOTHING RETURNING delta", [crypto.randomUUID(),job.user_id,job.id,job.cost]);
      if (refund.rowCount) await client.query('UPDATE users SET credits=credits+$1 WHERE id=$2', [job.cost,job.user_id]);
    }
    if (state === 'success' && job.kind === 'animate' && extra.result?.videoUrl) {
      const owned = await client.query("SELECT id,data FROM pets WHERE user_id=$1 AND data->'results' @> $2::jsonb FOR UPDATE", [job.user_id,JSON.stringify([{imageUrl:job.input.imageUrl}])]);
      for (const pet of owned.rows) {
        pet.data.results = pet.data.results.map((result) => result.imageUrl === job.input.imageUrl ? {...result, videoUrl:extra.result.videoUrl} : result);
        await client.query('UPDATE pets SET data=$1,version=version+1 WHERE id=$2 AND user_id=$3', [pet.data,pet.id,job.user_id]);
      }
    }
    logger.info({ jobId: job.id, userId: job.user_id, requestId: job.request_id, state }, 'generation state changed');
  });
}
async function runOne(adapter, workerId) {
  const job = await claim(workerId);
  if (!job) return false;
  const heartbeat = setInterval(() => {
    database().query("UPDATE generation_jobs SET lease_until=now()+interval '2 minutes' WHERE id=$1 AND locked_by=$2 AND lease_until>now()", [job.id,workerId])
      .catch((err) => logger.error({ err, jobId: job.id }, 'lease renewal failed'));
  }, 30000);
  try {
    if (job.state === 'submitting') {
      const submitted = await adapter.submit(job);
      if (submitted.upstreamId) await transition(job, 'polling', { upstreamId: submitted.upstreamId, delay: 3 });
      else if (submitted.result) await transition(job, 'materializing', { result: submitted.result });
      else throw new Error('Provider returned neither a task ID nor a result');
    } else if (job.state === 'polling') {
      const polled = await adapter.poll(job);
      if (polled.failed) await transition(job, 'failed', { error: '模型任务失败，内测额度已退回' });
      else if (polled.result) await transition(job, 'materializing', { result: polled.result });
      else if (Date.now() - new Date(job.created_at).getTime() > 3600000) await transition(job, 'needs_review', { error: '上游任务超过一小时仍未结束，请核对原任务' });
      else await transition(job, 'polling', { delay: 5 });
    } else {
      const result = await adapter.materialize(job);
      await transition(job, 'success', { result });
    }
  } catch (err) {
    logger.error({ err, jobId: job.id, requestId: job.request_id, state: job.state }, 'generation step failed');
    const state = job.state === 'submitting' ? (err.safeToRefund ? 'failed' : 'needs_review') : job.attempts >= 120 ? 'needs_review' : job.state;
    await transition(job, state, { error: state === 'needs_review' ? '任务需要人工核对；不会自动再次提交模型' : state === 'failed' ? '模型提交未完成，内测额度已退回' : '查询或成品保存暂时失败，正在重试原任务', delay: 15 });
  } finally { clearInterval(heartbeat); }
  return true;
}
module.exports = { enqueue, getJob, listJobs, publicJob, claim, transition, runOne, COSTS };
