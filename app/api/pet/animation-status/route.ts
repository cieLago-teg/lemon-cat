import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { getJob, listJobs, publicJob } from '@/lib/server/jobs.cjs';
export const GET = route('GET', async (request) => {
  const user = await requireUser(request);
  const taskId = new URL(request.url).searchParams.get('taskId');
  if (taskId) {
    const job = await getJob(user.id, taskId);
    return NextResponse.json({ task: job ? publicJob(job) : { taskId, missing: true } });
  }
  return NextResponse.json({ activeTasks: (await listJobs(user.id)).map(publicJob) });
});
