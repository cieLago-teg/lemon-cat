import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireOwnedVideo } from '@/lib/server/guard';
import { requireUser } from '@/lib/server/guard';
import { putAsset } from '@/lib/server/assets.cjs';
import { HttpError } from '@/lib/server/errors.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
// 网页服务器只验证素材，不能替远程用户启动服务器上的 Electron。
export const POST = route('POST', async (request) => {
  const body = await request.json();
  if (typeof body?.videoUrl !== 'string') return NextResponse.json({ error: '缺少视频地址' }, { status: 400 });
  await requireOwnedVideo(request, body.videoUrl);
  let playbackUrl = body.videoUrl;
  // 存量透明视频按需转为私有资产，旧文件保留，统一客户端不再访问公开目录。
  if (/^\/pet-videos\/[a-zA-Z0-9_.-]+\.webm$/.test(playbackUrl)) {
    const file = path.join(process.cwd(), 'public', playbackUrl.slice(1));
    if ((await fs.stat(file)).size > 40 * 1024 * 1024) throw new HttpError(413, '视频超过桌宠素材大小限制');
    const bytes = await fs.readFile(file);
    if (bytes.subarray(0, 4).toString('hex') !== '1a45dfa3') throw new HttpError(400, '视频格式无效');
    playbackUrl = await putAsset((await requireUser(request)).id, bytes, 'video/webm');
  }
  return NextResponse.json({ ok: true, shellLaunched: false, mode: 'browser', playbackUrl });
});
