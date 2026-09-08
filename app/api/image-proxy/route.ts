import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { readOwnedImage } from '@/lib/server/images';
export const GET = route('GET', async (request) => {
  await requireUser(request);
  const raw = new URL(request.url).searchParams.get('url') || '';
  const { bytes, contentType } = await readOwnedImage(request, raw);
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': contentType } });
});

