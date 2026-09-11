import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { enqueue, publicJob } from '@/lib/server/jobs.cjs';
import { putAsset } from '@/lib/server/assets.cjs';
import { inspectImage } from '@/lib/server/image-inspection.cjs';
import { generationOptions, validateFeatureInput } from '@/lib/generation-options';
import { buildPetImagePrompt, PROMPT_VERSION, styleNegativePrompt } from '@/lib/prompts';
import { resolveModels } from '@/lib/model-config';
export const POST = route('POST', async (request, _context, { requestId }) => {
  const user = await requireUser(request);
  const body = await request.json();
  if (!body || !Array.isArray(body.aiTags) || body.aiTags.length > 30 || body.aiTags.some((tag: unknown) => typeof tag !== 'string') ||
      (body.stylePrompts && (!Array.isArray(body.stylePrompts) || body.stylePrompts.length > 4))) {
    return NextResponse.json({ error: '无效的特征或风格参数' }, { status: 400 });
  }
  if (typeof body.imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.imageBase64) || body.imageBase64.length > 7 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(body.mimeType)) {
    return NextResponse.json({ error: '需要有效的宠物原图，不能仅凭文字生成定制形象' }, { status: 400 });
  }
  let options;
  try { options = generationOptions(body); validateFeatureInput(body); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : '生成参数无效' }, { status: 400 }); }
  const bytes = Buffer.from(body.imageBase64, 'base64');
  const inputQuality = await inspectImage(bytes, body.mimeType);
  const sourceImageUrl = await putAsset(user.id, bytes, body.mimeType);
  const input = { aiTags: body.aiTags, customFeatures: body.customFeatures || '', petVibe: body.petVibe || '', bgMode: 'white', styles: options.styles.map((s) => s.style), candidatesPerStyle: options.candidatesPerStyle, sourceImageUrl, inputQuality, parentJobId: body.parentJobId || null, sourceHash: createHash('sha256').update(bytes).digest('hex') };
  // 入队时冻结实际提示词和模型；随机种子在幂等检查之后产生。
  const plan = options.styles.flatMap(({ style, template }) => Array.from({ length: options.candidatesPerStyle }, (_, index) => ({ style, candidate: index + 1, prompt: buildPetImagePrompt(template, input), negativePrompt: styleNegativePrompt(style), model: resolveModels().image, promptVersion: PROMPT_VERSION })));
  const job = await enqueue(user.id, 'generate', request.headers.get('idempotency-key') || '', { ...input, plan }, requestId);
  return NextResponse.json({ taskId: job.id, task: publicJob(job) }, { status: 202 });
});
