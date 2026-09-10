const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { logger } = require('../lib/server/logger.cjs');

async function main() {
  const { values } = parseArgs({ options: { root: { type: 'string' }, feedback: { type: 'boolean' } } });
  if (Boolean(values.root) === Boolean(values.feedback)) throw new Error('请选择 --root 图片目录 或 --feedback');
  const directory = path.resolve('data/evaluations', `inventory-${crypto.randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  let report;
  if (values.root) {
    const samples = [], seen = new Set();
    async function visit(root) {
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const file = path.join(root, entry.name);
        if (entry.isDirectory()) await visit(file);
        else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) {
          const bytes = await fs.readFile(file), hash = crypto.createHash('sha256').update(bytes).digest('hex');
          if (!seen.has(hash)) { seen.add(hash); samples.push({ file, sha256: hash, species: null, petId: null, split: 'unassigned', difficulty: [], approvedForEvaluation: false }); }
        }
      }
    }
    await visit(path.resolve(values.root));
    report = { note: '仅盘点，无模型调用。人工确认猫狗、同宠物分组与使用许可后再评测；相同 petId 必须处于同一 split。建议 20 猫+20 狗，并另留调参集。', samples };
  } else {
    const { database, close } = require('../lib/server/db.cjs');
    try {
      const { rows } = await database().query("SELECT f.data,f.updated_at,j.input->>'sourceImageUrl' AS source,j.input->'plan' AS plan,r.image FROM image_feedback f JOIN generation_jobs j ON j.id=f.job_id AND j.user_id=f.user_id CROSS JOIN LATERAL jsonb_array_elements(j.result->'results') r(image) WHERE r.image->>'imageUrl'='/api/assets/'||f.asset_id::text");
      report = { note: '这是已反馈样本，不是全部用户的随机样本，不能直接当作总体成功率；没有训练授权。', count: rows.length, rows };
    } finally { await close(); }
  }
  await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(report, null, 2));
  logger.info({ directory, samples: report.samples?.length, feedback: report.count }, 'evaluation inventory saved; no model calls');
}
if (require.main === module) main().catch((err) => { logger.error({ err }, 'evaluation inventory failed'); process.exitCode = 1; });
