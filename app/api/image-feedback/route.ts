import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser, requireOwnedImage } from '@/lib/server/guard';
import { database } from '@/lib/server/db.cjs';
import { validateFeedback } from '@/lib/feedback';

export const POST = route('POST', async (request) => {
  const user = await requireUser(request), body = await request.json();
  if (typeof body.imageUrl !== 'string' || !/^\/api\/assets\/[a-f0-9-]{36}$/.test(body.imageUrl)) return NextResponse.json({ error: '无效的候选图片' }, { status: 400 });
  await requireOwnedImage(request, body.imageUrl);
  let data;
  try { data = validateFeedback(body); }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : '评分无效' }, { status: 400 }); }
  // 从真实任务关联来源；不接受浏览器伪造的模型、画风或 prompt 版本。
  const jobs = await database().query("SELECT id FROM generation_jobs WHERE user_id=$1 AND kind='generate' AND result->'results' @> $2::jsonb ORDER BY created_at DESC LIMIT 1", [user.id, JSON.stringify([{ imageUrl: body.imageUrl }])]);
  if (!jobs.rows[0]) return NextResponse.json({ error: '未找到这张图片对应的生成任务' }, { status: 404 });
  await database().query('INSERT INTO image_feedback(user_id,asset_id,job_id,data) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,asset_id) DO UPDATE SET job_id=EXCLUDED.job_id,data=EXCLUDED.data,updated_at=now()', [user.id, body.imageUrl.slice('/api/assets/'.length), jobs.rows[0].id, data]);
  return NextResponse.json({ saved: true });
});
