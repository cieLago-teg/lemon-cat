import { route } from '@/lib/server/http.cjs';
import { requireUser } from '@/lib/server/guard';
import { ownedAsset, readAsset } from '@/lib/server/assets.cjs';
import { requireVerifiedVideo } from '@/lib/server/identity.cjs';
export const runtime = 'nodejs';
export const GET = route('GET', async (request, context: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(request);
  const { id } = await context.params;
  const asset = await ownedAsset(user.id, id);
  if (asset.content_type.startsWith('video/')) await requireVerifiedVideo(user.id, `/api/assets/${id}`);
  const bytes = await readAsset(asset);
  const headers = { 'content-type': asset.content_type, 'accept-ranges': 'bytes' };
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    const start = match ? Number(match[1]) : -1;
    const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (start < 0 || start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${bytes.length}` } });
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${bytes.length}`, 'content-length': String(end-start+1) } });
  }
  return new Response(new Uint8Array(bytes), { headers: { ...headers, 'content-length': String(bytes.length) } });
});
