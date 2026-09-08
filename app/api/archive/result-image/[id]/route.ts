import { NextResponse } from 'next/server';
import { route } from '@/lib/server/http.cjs';
import { requireOwnedArchive } from '@/lib/server/guard';
import { readOwnedImage } from '@/lib/server/images';
export const GET = route('GET', async (request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const { archive } = await requireOwnedArchive(request,id);
  const style = new URL(request.url).searchParams.get('style');
  const result = archive.results?.find((item) => item.style === style);
  if (!result) return NextResponse.json({ error: 'Not found' }, { status:404 });
  const { bytes, contentType } = await readOwnedImage(request,result.imageUrl);
  return new Response(new Uint8Array(bytes), { headers: { 'content-type':contentType } });
});

