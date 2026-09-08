// 真实模型验收：必须显式提供原图；最多四种内置风格，每种一次生图、一次双图质检。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { logger } = require('../lib/server/logger.cjs');
const { generatePetImage, verifyPetIdentity } = require('../.worker/lib/bailian.js');
const { STYLE_PROMPTS, WHITE_BG_PANEL_CONSTRAINT, NON_ANTHRO_CONSTRAINT, TAIL_VISIBLE_CONSTRAINT } = require('../.worker/lib/prompts.js');
const { downloadMedia } = require('../lib/server/media-policy.cjs');
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run verify:identity -- path/to/original.jpg [style-index 0..3]');
  const ext = path.extname(file).toLowerCase();
  const mime = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' }[ext];
  if (!mime) throw new Error('Original must be PNG/JPEG/WebP');
  const original = fs.readFileSync(file);
  if (original.length > 5 * 1024 * 1024) throw new Error('Original exceeds 5 MB');
  const source = `data:${mime};base64,${original.toString('base64')}`;
  const index = process.argv[3] === undefined ? null : Number(process.argv[3]);
  if (index !== null && (!Number.isInteger(index) || index < 0 || index > 3)) throw new Error('Style index must be 0..3');
  const directory = path.resolve('data','evaluations',`identity-${crypto.randomUUID()}`);
  fs.mkdirSync(directory,{recursive:true});
  fs.copyFileSync(file,path.join(directory,`original${ext}`));
  const report = { sourceSha256:crypto.createHash('sha256').update(original).digest('hex'), imageModel:process.env.BAILIAN_PET_IMAGE_MODEL || 'qwen-image-edit-plus-2025-12-15', judgeModel:process.env.BAILIAN_IDENTITY_MODEL || 'qwen3-vl-plus', results:[] };
  try {
    for (const [i,style] of STYLE_PROMPTS.entries()) {
      if (index !== null && index !== i) continue;
      const url = await generatePetImage(`${style.template.replace('[宠物特征]','参考图中同一只宠物')}\n${NON_ANTHRO_CONSTRAINT}\n${TAIL_VISIBLE_CONSTRAINT}\n${WHITE_BG_PANEL_CONSTRAINT}`,source,report.imageModel);
      const image = await downloadMedia(url,5*1024*1024);
      const extension = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }[image.contentType];
      if (!extension) throw new Error('Generated result is not a supported image');
      const filename = `style-${i}.${extension}`;
      fs.writeFileSync(path.join(directory,filename),image.bytes);
      const verdict = await verifyPetIdentity(source,`data:${image.contentType};base64,${image.bytes.toString('base64')}`,report.judgeModel);
      report.results.push({ style:style.style, file:filename, ...verdict });
      fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));
      logger.info({style:style.style,passed:verdict.passed},'real pet identity acceptance');
    }
    if (report.results.some((result) => !result.passed)) process.exitCode=2;
  } finally { logger.info({directory,completedStyles:report.results.length},'identity acceptance evidence'); }
}
main().catch((err)=>{logger.error({err},'identity acceptance incomplete');process.exitCode=1;});
