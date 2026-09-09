const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const { parseArgs } = require('node:util');
const { logger } = require('../lib/server/logger.cjs');
const { downloadMedia } = require('../lib/server/media-policy.cjs');
const { resolveModels, IMAGE_MODELS, normalizeFeatureTags } = require('../.worker/lib/model-config.js');
const prompts = require('../.worker/lib/prompts.js');
const provider = require('../.worker/lib/bailian.js');

function historical(ref, file, seed) {
  if (!/^[a-f0-9]{7,40}$/.test(ref)) throw new Error('baseline 必须是已有提交的十六进制 hash');
  const source = execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', windowsHide: true });
  const absolute = path.resolve(file);
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (id === './auth') return require('../.worker/lib/auth.js');
    if (id === 'undici') {
      const undici = require('undici');
      return { ...undici, fetch: (url, options) => {
        const body = JSON.parse(options.body);
        // 为历史版本补入与新版相同的随机种子；其他参数及提示词沿用历史代码。
        if (body.parameters) body.parameters.seed = seed;
        return undici.fetch(url, { ...options, body: JSON.stringify(body) });
      } };
    }
    return nativeRequire(id);
  };
  const ts = require('typescript');
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, absolute);
  return mod.exports;
}

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function saveReport(directory, report) {
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2));
  const rows = [...new Set(report.images.map((item) => item.style))].map((style) => {
    const items = report.images.filter((item) => item.style === style).map((item) => `<article><h3>${item.variant.startsWith('baseline-') ? '旧提示词' : '优化提示词'}</h3><p>${escape(item.model)} · ${item.ms ?? 0} ms</p>${item.file ? `<img src="${escape(item.file)}" alt="${escape(style)}生成候选图">` : `<p>${escape(item.error || '尚未执行')}</p>`}<details><summary>查看提示词</summary><pre>${escape(item.prompt)}</pre></details></article>`).join('');
    return `<h2>${escape(style)}</h2><main>${items}</main>`;
  }).join('');
  const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><title>宠物模型对比</title><style>body{font-family:system-ui;background:#faf5ec;color:#463323;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}article{background:white;padding:16px;border-radius:16px}img{width:100%;max-height:400px;object-fit:contain}h2{font-size:20px}h3{font-size:17px}pre{white-space:pre-wrap;font-size:13px}</style><h1>宠物模型对比</h1><p>同一原图、相同种子；种子不能保证不同模型输出相同构图。没有 VL 裁判，请主人判断保真度与喜欢程度。</p><p>检查：脸部毛色/花纹、画风、完整轮廓、抠像边缘。故事不参与生成。本报告未证明任意宠物效果。</p><img style="width:240px" src="source${escape(report.extension)}" alt="宠物原图">${rows}<h2>特征提取结果</h2><pre>${escape(JSON.stringify(report.vision, null, 2))}</pre></html>`;
  await fs.writeFile(path.join(directory, 'index.html'), html);
}

async function main() {
  const { values } = parseArgs({ options: {
    image: { type: 'string' }, models: { type: 'string' }, styles: { type: 'string', default: '0,1,2,3' },
    features: { type: 'string', default: '' }, details: { type: 'string', default: '' },
    baseline: { type: 'string' }, seed: { type: 'string', default: '42' },
    'vision-models': { type: 'string' }, report: { type: 'string' }, run: { type: 'boolean', default: false }
  } });
  if (values.report) {
    const directory = path.resolve(values.report);
    const root = path.resolve('data/evaluations') + path.sep;
    if (!directory.startsWith(root)) throw new Error('report 必须位于本项目 data/evaluations 下');
    await saveReport(directory, JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8')));
    logger.info({ directory }, 'report rendered (no API calls)');
    return;
  }
  const configured = resolveModels();
  if (!values.image) {
    logger.info({ configured, supportedImageModels: IMAGE_MODELS, promptVersion: prompts.PROMPT_VERSION, legacyImageModelIgnored: Boolean(process.env.BAILIAN_IMAGE_MODEL), keyConfigured: Boolean(process.env.DASHSCOPE_API_KEY) }, 'model configuration (no API calls)');
    return;
  }
  const seed = Number(values.seed);
  if (!Number.isInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('seed 必须在 0 至 2147483647 之间');
  const selected = [...new Set(values.styles.split(',').map(Number))];
  if (!selected.length || selected.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) throw new Error('styles 使用 0,1,2,3 中的索引');
  const models = [...new Set((values.models || configured.image).split(',').map((x) => x.trim()))];
  if (models.some((model) => !IMAGE_MODELS.includes(model))) throw new Error('包含未支持的图像模型');
  const visions = values['vision-models'] ? [...new Set(values['vision-models'].split(',').map((x) => x.trim()))] : [];
  const imageCalls = selected.length * (models.length + Number(Boolean(values.baseline)));
  if (imageCalls > 12 || visions.length > 3) throw new Error('一次评估最多12张图片及3次特征提取，请拆分评估');
  const extension = path.extname(values.image).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extension];
  if (!mime) throw new Error('原图仅支持 PNG、JPEG、WEBP');
  const bytes = await fs.readFile(values.image);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('原图不可超过5MB');
  const source = `data:${mime};base64,${bytes.toString('base64')}`;
  const input = { aiTags: values.features ? normalizeFeatureTags(values.features) : [], customFeatures: values.details };
  const images = [];
  let baselineProvider;
  if (values.baseline) {
    const old = historical(values.baseline, 'lib/prompts.ts', seed);
    baselineProvider = historical(values.baseline, 'lib/bailian.ts', seed);
    const features = [input.aiTags.join('，'), input.customFeatures ? `补充特征：${input.customFeatures}` : ''].filter(Boolean).join('，');
    for (const index of selected) {
      const style = old.STYLE_PROMPTS[index];
      images.push({ variant: `baseline-${values.baseline}`, model: configured.image, style: style.style, prompt: `${old.injectPetFeatures(style.template, features)}\n${old.NON_ANTHRO_CONSTRAINT}\n${old.TAIL_VISIBLE_CONSTRAINT}\n${old.WHITE_BG_PANEL_CONSTRAINT}` });
    }
  }
  for (const model of models) for (const index of selected) {
    const style = prompts.STYLE_PROMPTS[index];
    images.push({ variant: prompts.PROMPT_VERSION, model, style: style.style, prompt: prompts.buildPetImagePrompt(style.template, input) });
  }
  const report = { createdAt: new Date().toISOString(), run: values.run, seed, extension, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex'), imageCalls, visionCalls: visions.length, images, vision: [] };
  const directory = path.resolve('data/evaluations', `model-lab-${crypto.randomUUID()}`);
  await fs.mkdir(directory, { recursive: true });
  await fs.copyFile(values.image, path.join(directory, `source${extension}`));
  await saveReport(directory, report);
  logger.info({ directory, imageCalls, visionCalls: visions.length, paidCallsEnabled: values.run }, 'model evaluation prepared');
  if (!values.run) return;
  // 每项只调用一次；失败留证据，不自动换模型或再次生图。
  for (const model of visions) {
    const started = Date.now();
    try { report.vision.push({ model, tags: normalizeFeatureTags(await provider.extractPetFeatures(source, model, prompts.DEFAULT_FEATURE_SYSTEM_PROMPT)), ms: Date.now() - started }); }
    catch (err) { logger.error({ err, model }, 'evaluation extraction failed'); report.vision.push({ model, error: err.message, ms: Date.now() - started }); process.exitCode = 1; }
    await saveReport(directory, report);
  }
  for (const [index, item] of images.entries()) {
    const started = Date.now();
    try {
      const client = item.variant.startsWith('baseline-') ? baselineProvider : provider;
      const url = await client.generatePetImage(item.prompt, source, item.model, seed);
      const media = await downloadMedia(url, 10 * 1024 * 1024);
      if (!media.contentType.startsWith('image/')) throw new Error('供应商返回的结果不是图片');
      item.file = `image-${index}.png`;
      await fs.writeFile(path.join(directory, item.file), media.bytes);
    } catch (err) { logger.error({ err, model: item.model, style: item.style }, 'evaluation image failed'); item.error = err.message; process.exitCode = 1; }
    item.ms = Date.now() - started;
    await saveReport(directory, report);
    logger.info({ index, model: item.model, ok: Boolean(item.file), ms: item.ms }, 'evaluation item finished');
  }
  logger.info({ report: path.join(directory, 'index.html') }, 'model evaluation finished');
}
if (require.main === module) main().catch((err) => { logger.error({ err }, 'model evaluation failed'); process.exitCode = 1; });
