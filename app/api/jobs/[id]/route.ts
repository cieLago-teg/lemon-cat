import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { getJob, publicJob } from '@/lib/server/jobs.cjs';
export const GET = route('GET', async (request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const job = await getJob(user.id, id);
  return job ? NextResponse.json({ task: publicJob(job) }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
});
