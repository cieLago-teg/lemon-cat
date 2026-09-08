import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { enqueue, publicJob } from '@/lib/server/jobs.cjs';
export const POST = route('POST', async (request, _context, { requestId }) => {
  const user = await requireUser(request);
  const body = await request.json();
  if (!body || typeof body.imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.imageBase64) || body.imageBase64.length > 7 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(body.mimeType)) {
    return NextResponse.json({ error: '请上传有效的 PNG/JPEG/WebP 图片（5MB 以内）' }, { status: 400 });
  }
  const job = await enqueue(user.id, 'extract', request.headers.get('idempotency-key') || '', body, requestId);
  return NextResponse.json({ taskId: job.id, task: publicJob(job) }, { status: 202 });
});
