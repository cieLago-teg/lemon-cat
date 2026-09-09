const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// 在隔离模块中执行真实 TS 请求构建器和 worker，不连接数据库或模型。
function load(file, mocks = {}, cache = new Map()) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    const target = path.resolve(path.dirname(absolute), id);
    if (id.startsWith('.') && fs.existsSync(target + '.ts')) return load(target + '.ts', mocks, cache);
    return nativeRequire(id);
  };
  cache.set(absolute, mod);
  mod._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, absolute);
  return mod.exports;
}
const models = load('lib/model-config.ts');
const prompts = load('lib/prompts.ts');

test('pet model configuration ignores the obsolete text-only model and keeps defaults', () => {
  assert.equal(models.resolveModels({ BAILIAN_IMAGE_MODEL: 'qwen-image-2.0' }).image, models.DEFAULT_MODELS.image);
  assert.equal(models.resolveModels({ BAILIAN_PET_IMAGE_MODEL: ' qwen-image-3.0 ' }).image, 'qwen-image-3.0');
});

test('all supported editing models send the original image and explicit non-rewriting parameters', () => {
  for (const model of models.IMAGE_MODELS) {
    const request = models.buildPetImageRequest('保留灰白斑纹', 'data:image/png;base64,original', model, 42);
    assert.deepEqual(request.input.messages[0].content, [{ image: 'data:image/png;base64,original' }, { text: '保留灰白斑纹' }]);
    assert.equal(request.parameters.prompt_extend, false);
    assert.equal(request.parameters.seed, 42);
    assert.equal(request.parameters.n, 1);
  }
  assert.throws(() => models.buildPetImageRequest('pet', 'source', 'qwen-image'), /未支持/);
  assert.throws(() => models.buildPetImageRequest('pet', '', models.DEFAULT_MODELS.image), /原图/);
  assert.throws(() => models.buildPetImageRequest('pet', 'source', models.DEFAULT_MODELS.image, -1), /seed/);
});

test('complete feature tags survive past 150 characters; no split inside decimal values', () => {
  const tags = Array.from({ length: 14 }, (_, i) => `第${i}项可见毛色及花纹位置描述`);
  tags.push('尾尖约1.5厘米白色');
  assert.deepEqual(models.normalizeFeatureTags(tags.join('，')), tags);
  assert.deepEqual(models.normalizeFeatureTags('输出：灰猫，灰猫\n长毛'), ['灰猫', '长毛']);
  assert.throws(() => models.normalizeFeatureTags('，\n'), /为空/);
});

test('each style carries owner correction, preserved tags and background without sending the story', () => {
  for (const style of prompts.STYLE_PROMPTS) {
    const prompt = prompts.buildPetImagePrompt(style.template, { aiTags: ['白爪', '长尾'], customFeatures: '其实是短尾', petVibe: '安静', petStory: '私密故事不发送' });
    assert.match(prompt, /主人明确补充与修正（优先于识别标签）：其实是短尾/);
    assert.match(prompt, /白爪，长尾/);
    assert.match(prompt, /#FFFFFF/);
    assert.doesNotMatch(prompt, /私密故事|\[宠物特征\]|无论原图是否露出尾巴|强制 16x16/);
  }
  assert.match(prompts.buildPetImagePrompt('自定义[宠物特征]', { bgMode: 'green' }), /绿幕/);
  assert.doesNotMatch(prompts.buildPetImagePrompt('自定义', { bgMode: 'none' }), /#FFFFFF|绿幕/);
});

test('vision request keeps image and prompt and disables thinking only for known hybrid families', () => {
  for (const model of ['qwen3-vl-plus', 'qwen3.7-flash-2026-07-15', 'qwen3.8-flash']) {
    const request = models.buildVisionRequest('original', model, 'facts only');
    assert.equal(request.enable_thinking, false);
    assert.equal(request.messages[1].content[0].image_url.url, 'original');
  }
  assert.equal(models.buildVisionRequest('original', 'qwen3.8-max', 'facts').enable_thinking, undefined);
});

test('Wan 2.6 and 2.7 use different reference protocols without mismatched audio parameters', () => {
  const old = models.buildPetVideoRequest('blink', 'selected', 'wan2.6-i2v-flash');
  assert.equal(old.input.img_url, 'selected');
  assert.equal(old.parameters.audio, false);
  assert.equal(old.parameters.duration, 5);
  const next = models.buildPetVideoRequest('blink', 'selected', 'wan2.7-i2v-2026-04-25');
  assert.deepEqual(next.input.media, [{ type: 'first_frame', url: 'selected' }, { type: 'last_frame', url: 'selected' }]);
  assert.equal(next.input.img_url, undefined);
  assert.equal(next.parameters.audio, undefined);
  assert.equal(next.parameters.prompt_extend, false);
});

test('provider sends the built request on the wire; truncated VL responses fail visibly', async () => {
  const sent = [];
  let truncated = false;
  const tags = Array.from({ length: 14 }, (_, i) => `第${i}项可见毛色及花纹位置描述`).join('，');
  const provider = load('lib/bailian.ts', {
    './auth': { ensureAuth: () => ({ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: 'test-key' }) },
    undici: { Agent: class {}, fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      sent.push({ url, body });
      const data = url.endsWith('/chat/completions')
        ? { choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content: tags } }] }
        : { output: { choices: [{ message: { content: [{ image: 'https://dashscope-result.oss.aliyuncs.com/result.png' }] } }] } };
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    } }
  });
  await assert.rejects(provider.generatePetImage('pet', '', 'qwen-image-3.0'), /原图/);
  assert.equal(sent.length, 0, 'missing original must never turn into a text-only paid call');
  assert.equal(await provider.extractPetFeatures('original', 'qwen3-vl-plus', 'facts'), tags);
  truncated = true;
  await assert.rejects(provider.extractPetFeatures('original', 'qwen3-vl-plus', 'facts'), /截断/);
  await provider.generatePetImage('pet', 'original', 'qwen-image-3.0', 42);
  assert.equal(sent[2].url, 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
  assert.deepEqual(sent[2].body, models.buildPetImageRequest('pet', 'original', 'qwen-image-3.0', 42));
});

test('actual worker returns every generated style with its model provenance and no VL review', async (t) => {
  const calls = [];
  const root = process.cwd();
  const logger = { info() {}, error() {} };
  const previousKey = process.env.DASHSCOPE_API_KEY;
  process.env.DASHSCOPE_API_KEY = 'test-key-never-sent';
  t.after(() => { if (previousKey === undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY = previousKey; });
  const mocks = {
    '../lib/bailian': { generatePetImage: async (...args) => { calls.push(args); return 'https://dashscope-result.oss.aliyuncs.com/image.png'; } },
    [path.join(root, 'lib/server/assets.cjs')]: { ownedAsset: async () => ({ content_type: 'image/png' }), readAsset: async () => Buffer.from('original'), putAsset: async () => `/api/assets/result-${calls.length}` },
    [path.join(root, 'lib/server/media-policy.cjs')]: { downloadMedia: async () => ({ bytes: Buffer.from('image'), contentType: 'image/png' }) },
    [path.join(root, 'lib/server/logger.cjs')]: { logger },
    [path.join(root, 'lib/server/db.cjs')]: {},
    [path.join(root, 'lib/server/jobs.cjs')]: {},
    [path.join(root, 'lib/pet/rvm-matting.js')]: {}
  };
  const { adapter } = load('scripts/worker.ts', mocks);
  const job = { id: 'test', user_id: 'owner', kind: 'generate', input: { sourceImageUrl: '/api/assets/original', aiTags: ['银灰长毛'], customFeatures: '耳尖黑色', petStory: '不传入故事' } };
  const submitted = await adapter.submit(job);
  assert.equal(calls.length, 4);
  const result = await adapter.materialize({ ...job, result: submitted.result });
  assert.equal(result.results.length, 4);
  for (const [prompt, source, model] of calls) {
    assert.match(prompt, /耳尖黑色/);
    assert.doesNotMatch(prompt, /不传入故事/);
    assert.equal(source, `data:image/png;base64,${Buffer.from('original').toString('base64')}`);
    assert.equal(model, models.resolveModels().image);
  }
  assert.equal(result.results[0].promptVersion, prompts.PROMPT_VERSION);
});

test('Wan 2.7 worker loads owned image bytes once and submits matching endpoints without requiring public storage', async (t) => {
  const root = process.cwd();
  const previous = { DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY, DASHSCOPE_VIDEO_MODEL: process.env.DASHSCOPE_VIDEO_MODEL };
  process.env.DASHSCOPE_API_KEY = 'test-key-never-sent';
  process.env.DASHSCOPE_VIDEO_MODEL = 'wan2.7-i2v-2026-04-25';
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  let payload;
  let ownershipReads = 0;
  const mocks = {
    '../lib/bailian': { getDashscopeAgent: () => undefined },
    undici: { fetch: async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ output: { task_id: 'upstream-id' } }) }; } },
    [path.join(root, 'lib/server/assets.cjs')]: {
      ownedAsset: async (user, id) => { assert.equal(user, 'owner'); assert.equal(id, 'selected'); ownershipReads++; return { content_type: 'image/png' }; },
      readAsset: async () => Buffer.from('owned-image'),
      providerAssetUrl: async () => { throw new Error('must not require public storage for 2.7 private image'); }
    },
    [path.join(root, 'lib/server/logger.cjs')]: { logger: { info() {}, error() {} } },
    [path.join(root, 'lib/server/db.cjs')]: {},
    [path.join(root, 'lib/server/jobs.cjs')]: {},
    [path.join(root, 'lib/pet/rvm-matting.js')]: {}
  };
  const { adapter } = load('scripts/worker.ts', mocks);
  assert.deepEqual(await adapter.submit({ user_id: 'owner', kind: 'animate', input: { imageUrl: '/api/assets/selected', style: '和纸拼贴绘本风' } }), { upstreamId: 'upstream-id' });
  assert.equal(ownershipReads, 1);
  assert.match(payload.input.prompt, /cut-paper/);
  assert.equal(payload.input.media[0].url, payload.input.media[1].url);
  assert.match(payload.input.media[0].url, /^data:image\/png;base64,/);
  await assert.rejects(adapter.submit({ user_id: 'owner', kind: 'animate', input: { imageUrl: '/api/assets/selected', sourceImageUrl: '/api/assets/other' } }), /Cannot replace/);
});
