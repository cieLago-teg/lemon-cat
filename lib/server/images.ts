import fs from 'node:fs/promises';
import { getResultImageFilePath, parseLocalResultImagePath } from '../db/archive';
import { ownedAsset, readAsset } from './assets.cjs';
import { requireOwnedImage, requireUser } from './guard';
import { downloadMedia } from './media-policy.cjs';
export async function readOwnedImage(request: Request, raw: string) {
  const localAlias = /^local:\/\/image\/([a-z0-9]+)-(\d+)\.(png|jpg|jpeg|webp)$/i.exec(raw);
  if (localAlias) raw = `/api/archive/image/${localAlias[1]}/${localAlias[2]}.${localAlias[3]}`;
  await requireOwnedImage(request, raw);
  if (raw.startsWith('/api/assets/')) {
    const asset = await ownedAsset((await requireUser(request)).id, raw.slice('/api/assets/'.length));
    return { bytes: await readAsset(asset), contentType: asset.content_type };
  }
  const local = parseLocalResultImagePath(raw);
  if (local) return { bytes: await fs.readFile(getResultImageFilePath(local.archiveId,local.index,local.ext)), contentType: `image/${local.ext === 'jpg' ? 'jpeg' : local.ext}` };
  const data = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(raw);
  if (data) return { bytes: Buffer.from(data[2],'base64'), contentType: data[1] };
  return downloadMedia(raw, 5 * 1024 * 1024);
}
