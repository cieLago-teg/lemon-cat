import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { enqueue, publicJob } from '@/lib/server/jobs.cjs';
import { putAsset } from '@/lib/server/assets.cjs';
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
  const sourceImageUrl = await putAsset(user.id, Buffer.from(body.imageBase64, 'base64'), body.mimeType);
  const input = { ...body };
  delete input.imageBase64;
  const job = await enqueue(user.id, 'generate', request.headers.get('idempotency-key') || '', { ...input, sourceImageUrl }, requestId);
  return NextResponse.json({ taskId: job.id, task: publicJob(job) }, { status: 202 });
});
