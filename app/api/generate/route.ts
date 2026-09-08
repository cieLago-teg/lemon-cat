import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { enqueue, publicJob } from '@/lib/server/jobs.cjs';
export const POST = route('POST', async (request, _context, { requestId }) => {
  const user = await requireUser(request);
  const body = await request.json();
  if (!body || !Array.isArray(body.aiTags) || body.aiTags.length > 30 || body.aiTags.some((tag: unknown) => typeof tag !== 'string') ||
      (body.stylePrompts && (!Array.isArray(body.stylePrompts) || body.stylePrompts.length > 4))) {
    return NextResponse.json({ error: '无效的特征或风格参数' }, { status: 400 });
  }
  const job = await enqueue(user.id, 'generate', request.headers.get('idempotency-key') || '', body, requestId);
  return NextResponse.json({ taskId: job.id, task: publicJob(job) }, { status: 202 });
});
