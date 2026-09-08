import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
export const POST = route('POST', async (request) => {
  await requireUser(request);
  return NextResponse.json({ error: '服务器不再启动桌宠，请在桌面客户端选择已保存的动态形态' }, { status: 410 });
});
