import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { readOwnedImage } from '@/lib/server/images';
import { matteImageBuffer } from '@/lib/pet/rvm-matting.js';
import { throttle } from '@/lib/server/auth.cjs';
export const POST = route('POST', async (request) => {
  const user = await requireUser(request);
  await throttle(`matte-image:${user.id}`,6,60);
  const body = await request.json();
  const { bytes } = await readOwnedImage(request, body.imageUrl || '');
  const output = await matteImageBuffer(bytes);
  return NextResponse.json({ ok: true, pngDataUrl: 'data:image/png;base64,' + output.toString('base64') });
});
