const { database } = require('./db.cjs');
const { HttpError } = require('./errors.cjs');

// 只相信 worker 写入的、绑定具体素材的质检记录，不相信档案或请求里的 passed。
function parseVerdict(raw) {
  const verdict = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
  if (!verdict || !['pass', 'fail', 'uncertain'].includes(verdict.verdict) ||
      typeof verdict.reason !== 'string' || !verdict.reason.trim() ||
      !Array.isArray(verdict.matches) || !verdict.matches.every((v) => typeof v === 'string' && v.trim()) ||
      !Array.isArray(verdict.conflicts) || !verdict.conflicts.every((v) => typeof v === 'string' && v.trim())) {
    throw new Error('Invalid Qwen identity verdict');
  }
  const passed = verdict.verdict === 'pass' && new Set(verdict.matches.map((v) => v.trim())).size >= 2 && verdict.conflicts.length === 0;
  return { ...verdict, passed };
}
async function requireVerifiedImage(userId, imageUrl) {
  const { rows } = await database().query("SELECT 1 FROM identity_checks WHERE user_id=$1 AND image_url=$2 AND passed=true AND policy='pet-identity-v1' LIMIT 1", [userId, imageUrl]);
  if (!rows.length) throw new HttpError(422, '该形象尚未通过原宠物一致性质检，请用原图重新生成；未调用视频模型');
}
async function requireVerifiedVideo(userId, videoUrl) {
  const { rows } = await database().query("SELECT 1 FROM generation_jobs j JOIN identity_checks c ON c.user_id=j.user_id AND c.image_url=j.input->>'imageUrl' WHERE j.user_id=$1 AND j.kind='animate' AND j.state='success' AND j.result->>'videoUrl'=$2 AND c.passed=true AND c.policy='pet-identity-v1' AND COALESCE(j.input->>'sourceImageUrl',j.input->>'imageUrl')=c.image_url LIMIT 1", [userId, videoUrl]);
  if (!rows.length) throw new HttpError(422, '此视频缺少原宠物一致性质检记录，请先重新生成通过质检的形象');
}
module.exports = { parseVerdict, requireVerifiedImage, requireVerifiedVideo };
