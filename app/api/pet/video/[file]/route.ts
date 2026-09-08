import fs from 'node:fs/promises';
import path from 'node:path';
import { route } from '@/lib/server/http.cjs';
import { requireOwnedVideo } from '@/lib/server/guard';
export const GET = route('GET', async (request, context: { params: Promise<{ file: string }> }) => {
  const { file } = await context.params;
  await requireOwnedVideo(request, `/pet-videos/${file}`);
  const bytes = await fs.readFile(path.join(process.cwd(),'public/pet-videos',file));
  return new Response(new Uint8Array(bytes), { headers: { 'content-type': file.endsWith('.webm') ? 'video/webm' : 'video/mp4' } });
});
