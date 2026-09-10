const sharp = require('sharp');
const { HttpError } = require('./errors.cjs');
const { logger } = require('./logger.cjs');
const { pixelQuality } = require('../image-quality.cjs');

async function inspectImage(bytes, mime, output = false) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) throw new HttpError(400, '图片必须在 5MB 以内');
  const image = sharp(bytes, { limitInputPixels: 24 * 1024 * 1024, failOn: 'error' });
  let metadata, sample;
  try {
    metadata = await image.metadata();
    if ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[metadata.format] !== mime) throw new HttpError(400, '图片真实格式与声明不匹配');
    if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 32 || (metadata.pages || 1) > 1) throw new HttpError(400, '请上传尺寸至少 32 像素的静态图片');
    sample = await image.rotate().resize({ width: 128, height: 128, fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch (err) {
    logger.warn({ err, bytes: bytes.length, mime }, 'image decoding rejected');
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, '图片无法解码或像素过大，请重新选择 PNG/JPEG/WebP 图片');
  }
  const quality = pixelQuality(sample.data, sample.info.width, sample.info.height, output);
  if (!output && Math.min(metadata.width, metadata.height) < 384) quality.warnings.unshift('图片分辨率偏低，建议换一张更清晰的原图');
  return { width: metadata.width, height: metadata.height, ...quality };
}
module.exports = { inspectImage };
