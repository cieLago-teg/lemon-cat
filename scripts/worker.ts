import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { extractPetFeatures, generatePetImage, verifyPetIdentity, getDashscopeAgent } from '../lib/bailian';
import { resolveFeatureSystemPrompt, resolveStylePrompts, injectPetFeatures, NON_ANTHRO_CONSTRAINT, TAIL_VISIBLE_CONSTRAINT, WHITE_BG_PANEL_CONSTRAINT, CHROMA_KEY_BG_CONSTRAINT } from '../lib/prompts';
import { fetch as upstreamFetch } from 'undici';

// 编译输出仍使用工作目录中的 CJS 模块，避免复制原生 ONNX/FFmpeg 依赖。
const root = process.cwd();
const { database, close } = require(path.join(root, 'lib/server/db.cjs'));
const { runOne } = require(path.join(root, 'lib/server/jobs.cjs'));
const { logger } = require(path.join(root, 'lib/server/logger.cjs'));
const { config } = require(path.join(root, 'lib/server/config.cjs'));
const { putAsset, providerAssetUrl, ownedAsset, readAsset } = require(path.join(root, 'lib/server/assets.cjs'));
const { requireVerifiedImage } = require(path.join(root, 'lib/server/identity.cjs'));
const { downloadMedia, isProviderMediaUrl } = require(path.join(root, 'lib/server/media-policy.cjs'));
const { resolveDashscopeVideoBaseUrl } = require(path.join(root, 'lib/pet/dashscope-video-config.js'));
const { buildIdlePrompt } = require(path.join(root, 'lib/pet/animation-prompt.js'));
const { mattingVideo } = require(path.join(root, 'lib/pet/rvm-matting.js'));
type ResultImage = { style: string; imageUrl: string; prompt: string };
type JobInput = { sourceImageUrl?: string; imageUrl: string; imageBase64: string; mimeType: string; featureSystemPrompt?: string; petVibe?: string; aiTags?: string[]; customFeatures?: string; stylePrompts?: Parameters<typeof resolveStylePrompts>[0]; bgMode?: string; prompt?: string; style?: string };
type Job = { id: string; user_id: string; kind: string; input: JobInput; result: { results: ResultImage[]; videoUrl: string }; upstream_id: string };
type WanPayload = { output?: { task_id?: string; task_status?: string; video_url?: string; results?: { video_url?: string } | Array<{ video_url?: string }> } };

async function imageData(userId: string, url: string) {
  if (!url?.startsWith('/api/assets/')) throw new Error('需要持久化的原图素材，请重新上传');
  const asset = await ownedAsset(userId, url.slice('/api/assets/'.length));
  if (!asset.content_type.startsWith('image/')) throw new Error('Identity source must be an image');
  return `data:${asset.content_type};base64,${(await readAsset(asset)).toString('base64')}`;
}

async function wan(endpoint: string, body?: unknown) {
  const response = await upstreamFetch(`${resolveDashscopeVideoBaseUrl(process.env).replace(/\/$/, '')}${endpoint}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(60000), dispatcher: getDashscopeAgent(),
    headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`, 'Content-Type': 'application/json', ...(body ? { 'X-DashScope-Async': 'enable' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) {
    const err = Object.assign(new Error(`Wan HTTP ${response.status}`), { safeToRefund: body && [400,401,403,422,429].includes(response.status) });
    throw err;
  }
  return await response.json() as WanPayload;
}
async function reference(job: Job) {
  const source = job.input.sourceImageUrl || job.input.imageUrl;
  if (source.startsWith('/api/assets/')) return providerAssetUrl(job.user_id, source);
  if (isProviderMediaUrl(source)) return source;
  const local = /^\/api\/archive\/image\/([a-z0-9]+)\/(\d+)\.(png|jpg|jpeg|webp)$/i.exec(source);
  if (local) {
    const { rowCount } = await database().query('SELECT 1 FROM pets WHERE id=$1 AND user_id=$2', [local[1],job.user_id]);
    if (!rowCount) throw Object.assign(new Error('Reference archive not owned'), { safeToRefund: true });
    const bytes = await fs.readFile(path.join(root,'data/archive-images',`${local[1]}-result-${local[2]}.${local[3]}`));
    const asset = await putAsset(job.user_id, bytes, `image/${local[3] === 'jpg' ? 'jpeg' : local[3]}`);
    return providerAssetUrl(job.user_id, asset);
  }
  const data = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);
  if (data) return providerAssetUrl(job.user_id, await putAsset(job.user_id, Buffer.from(data[2], 'base64'), data[1]));
  throw Object.assign(new Error('Unsupported reference image'), { safeToRefund: true });
}
export const adapter = {
  async submit(job: Job) {
    if (!process.env.DASHSCOPE_API_KEY) throw Object.assign(new Error('Provider key not configured'), { safeToRefund: true });
    const body = job.input;
    if (job.kind === 'extract') {
      const petFeatures = await extractPetFeatures(`data:${body.mimeType};base64,${body.imageBase64}`, process.env.BAILIAN_VL_MODEL || 'qwen3-vl-plus', resolveFeatureSystemPrompt(body.featureSystemPrompt));
      return { result: { petFeatures, tags: petFeatures.split(/[,，、。.\n]/).map((tag) => tag.trim()).filter(Boolean) } };
    }
    if (job.kind === 'generate') {
      const source = await imageData(job.user_id, body.sourceImageUrl || '');
      const combinedFeatures = [body.petVibe ? `${body.petVibe}的氛围与神态` : '', (body.aiTags || []).join('，'), body.customFeatures ? `补充特征：${body.customFeatures}` : ''].filter(Boolean).join('，');
      const results = [];
      for (const { style, template } of resolveStylePrompts(body.stylePrompts)) {
        const bg = body.bgMode === 'green' ? CHROMA_KEY_BG_CONSTRAINT : body.bgMode === 'none' ? '' : WHITE_BG_PANEL_CONSTRAINT;
        const prompt = `${injectPetFeatures(template, combinedFeatures)}\n${NON_ANTHRO_CONSTRAINT}\n${TAIL_VISIBLE_CONSTRAINT}\n${bg}`;
        const generated = await generatePetImage(prompt, source, process.env.BAILIAN_PET_IMAGE_MODEL || 'qwen-image-edit-plus-2025-12-15');
        const { bytes, contentType } = await downloadMedia(generated, 5 * 1024 * 1024);
        const imageUrl = await putAsset(job.user_id, bytes, contentType);
        results.push({ style, imageUrl, prompt });
      }
      return { result: { results } };
    }
    await requireVerifiedImage(job.user_id, body.imageUrl);
    if (body.sourceImageUrl && body.sourceImageUrl !== body.imageUrl) throw new Error('Cannot replace verified reference');
    const imageUrl = await reference(job);
    const payload = await wan('/services/aigc/video-generation/video-synthesis', {
      model: process.env.DASHSCOPE_VIDEO_MODEL || 'wan2.6-i2v-flash',
      input: { prompt: buildIdlePrompt(body.prompt || '', body.style || ''), img_url: imageUrl },
      parameters: { resolution: '720P', watermark: false, prompt_extend: true, audio: false }
    });
    return { upstreamId: payload.output?.task_id };
  },
  async poll(job: Job) {
    const payload = await wan(`/tasks/${encodeURIComponent(job.upstream_id)}`);
    const output = payload.output;
    if (['FAILED','CANCELED'].includes(output?.task_status || '')) return { failed: true };
    if (output?.task_status !== 'SUCCEEDED') return {};
    const videoUrl = output.video_url || (Array.isArray(output.results) ? output.results.find((r) => r.video_url)?.video_url : output.results?.video_url);
    if (!videoUrl) throw new Error('Wan succeeded without a video URL');
    return { result: { videoUrl } };
  },
  async materialize(job: Job) {
    if (job.kind === 'extract') return job.result;
    if (job.kind === 'generate') {
      const results = [];
      const rejected = [];
      const source = await imageData(job.user_id, job.input.sourceImageUrl || '');
      const model = process.env.BAILIAN_IDENTITY_MODEL || 'qwen3-vl-plus';
      for (const item of job.result.results) {
        const previous = await database().query('SELECT verdict FROM identity_checks WHERE job_id=$1 AND image_url=$2', [job.id, item.imageUrl]);
        let verdict = previous.rows[0]?.verdict;
        if (!verdict) {
          try { verdict = await verifyPetIdentity(source, await imageData(job.user_id, item.imageUrl), model); }
          catch (err) { throw Object.assign(new Error('一致性质检暂时无法完成，结果已拦截；不会自动再次生图', { cause: err }), { identityBlocked: true }); }
        }
        await database().query("INSERT INTO identity_checks(job_id,user_id,image_url,source_url,model,policy,passed,verdict) VALUES($1,$2,$3,$4,$5,'pet-identity-v1',$6,$7) ON CONFLICT(job_id,image_url) DO NOTHING", [job.id, job.user_id, item.imageUrl, job.input.sourceImageUrl, model, verdict.passed, verdict]);
        logger.info({ jobId: job.id, passed: verdict.passed, model }, 'pet identity checked');
        if (verdict.passed) results.push({ ...item, identity: verdict });
        else rejected.push({ style: item.style, reason: verdict.reason });
      }
      if (!results.length) throw Object.assign(new Error('所有形象均未通过原宠物一致性质检，请调整原图或风格后重新生成'), { identityBlocked: true });
      return { results, rejected };
    }
    const { bytes, contentType } = await downloadMedia(job.result.videoUrl);
    const directory = path.join(config().dataDir, 'work', job.id);
    await fs.mkdir(directory, { recursive: true });
    const input = path.join(directory, contentType === 'video/webm' ? 'input.webm' : 'input.mp4');
    const output = path.join(directory, 'pet.webm');
    await fs.writeFile(input, bytes);
    // 抠像失败不再假装桌宠成品成功；只重试保存阶段，不再次生成。
    await mattingVideo(input, output);
    const videoUrl = await putAsset(job.user_id, await fs.readFile(output), 'video/webm');
    return { videoUrl };
  }
};

async function main() {
  const id = crypto.randomUUID();
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  logger.info({ workerId: id }, 'worker starting');
  const heartbeat = setInterval(() => {
    database().query('INSERT INTO worker_heartbeats(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET updated_at=now()', [id])
      .catch((err: unknown) => logger.error({ err, workerId: id }, 'worker heartbeat failed'));
  }, 30000);
  while (!stopping) {
    try {
      await database().query('INSERT INTO worker_heartbeats(id) VALUES($1) ON CONFLICT(id) DO UPDATE SET updated_at=now()', [id]);
      if (!await runOne(adapter, id)) await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (err) {
      logger.error({ err, workerId: id }, 'worker loop failed');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await database().query('DELETE FROM worker_heartbeats WHERE id=$1', [id]);
  clearInterval(heartbeat);
  await close();
}
if (require.main === module) main().catch((err) => { logger.error({ err }, 'worker stopped unexpectedly'); process.exitCode = 1; });
