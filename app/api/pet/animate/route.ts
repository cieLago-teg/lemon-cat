import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser, requireOwnedImage } from '@/lib/server/guard';
import { enqueue, publicJob } from '@/lib/server/jobs.cjs';
export const POST = route('POST', async (request, _context, { requestId }) => {
  const user = await requireUser(request);
  const body = await request.json();
  if (!body || typeof body.imageUrl !== 'string') return NextResponse.json({ error: '缺少参考图' }, { status: 400 });
  await requireOwnedImage(request, body.imageUrl);
  if (body.sourceImageUrl) await requireOwnedImage(request, body.sourceImageUrl);
  if (body.sourceImageUrl && body.sourceImageUrl !== body.imageUrl) return NextResponse.json({ error: '视频必须使用当前选择的形象，不支持替换参考图' }, { status: 422 });
  const job = await enqueue(user.id, 'animate', request.headers.get('idempotency-key') || '', body, requestId);
  return NextResponse.json({ ok: true, taskId: job.id, task: publicJob(job) }, { status: 202 });
});
