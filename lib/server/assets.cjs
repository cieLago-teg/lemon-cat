const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { database } = require('./db.cjs');
const { config } = require('./config.cjs');
const { HttpError } = require('./errors.cjs');
let s3;
function storage(backend = config().storage) {
  if (backend !== 's3') return null;
  const { S3Client } = require('@aws-sdk/client-s3');
  if (!process.env.S3_BUCKET || !process.env.S3_REGION) throw new Error('S3_BUCKET and S3_REGION required');
  s3 ||= new S3Client({ region: process.env.S3_REGION, ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}) });
  return s3;
}
async function putAsset(userId, bytes, contentType) {
  if (!['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(contentType) || !bytes.length || bytes.length > 40 * 1024 * 1024) throw new Error('Invalid asset type or size');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const existing = await database().query('SELECT id FROM assets WHERE user_id=$1 AND sha256=$2 AND backend=$3 AND content_type=$4 LIMIT 1', [userId,hash,config().storage,contentType]);
  if (existing.rows[0]) return `/api/assets/${existing.rows[0].id}`;
  const id = crypto.randomUUID();
  const objectKey = `${userId}/${id}`;
  const client = storage();
  if (client) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey, Body: bytes, ContentType: contentType }));
  } else {
    const file = path.join(config().dataDir, 'assets', objectKey);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
  }
  await database().query('INSERT INTO assets(id,user_id,object_key,content_type,size,sha256,backend) VALUES($1,$2,$3,$4,$5,$6,$7)', [id,userId,objectKey,contentType,bytes.length,hash,config().storage]);
  return `/api/assets/${id}`;
}
async function ownedAsset(userId, id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, 'Not found');
  const { rows } = await database().query('SELECT * FROM assets WHERE id=$1 AND user_id=$2', [id,userId]);
  if (!rows[0]) throw new HttpError(404, 'Not found');
  return rows[0];
}
async function readAsset(asset) {
  const client = storage(asset.backend);
  let bytes;
  if (client) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const result = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.object_key }));
    bytes = Buffer.from(await result.Body.transformToByteArray());
  } else {
    bytes = await fs.readFile(path.join(config().dataDir, 'assets', asset.object_key));
  }
  if (bytes.length !== asset.size || crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Asset integrity check failed');
  return bytes;
}
async function providerAssetUrl(userId, url) {
  const asset = await ownedAsset(userId, url.slice('/api/assets/'.length));
  if (asset.backend === 'local' && config().storage === 's3') {
    return providerAssetUrl(userId, await putAsset(userId,await readAsset(asset),asset.content_type));
  }
  const client = storage(asset.backend);
  if (!client) {
    const err = new Error('Private image requires configured S3 storage accessible to Wan');
    err.safeToRefund = true;
    throw err;
  }
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  return getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.object_key }), { expiresIn: 3600 });
}
async function checkStorage() {
  const client = storage();
  if (!client) { await fs.access(config().dataDir); return 'local_only'; }
  const { HeadBucketCommand } = require('@aws-sdk/client-s3');
  await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }), { abortSignal: AbortSignal.timeout(5000) });
  return 'ok';
}
module.exports = { putAsset, ownedAsset, readAsset, providerAssetUrl, checkStorage };
