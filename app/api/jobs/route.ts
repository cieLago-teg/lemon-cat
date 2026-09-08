import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { database } from '@/lib/server/db.cjs';
import { publicJob, type Job } from '@/lib/server/jobs.cjs';
export const GET = route('GET', async (request) => {
  const user = await requireUser(request);
  const { rows } = await database().query('SELECT * FROM generation_jobs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [user.id]);
  return NextResponse.json({ jobs: rows.map((row) => publicJob(row as unknown as Job)) });
});
