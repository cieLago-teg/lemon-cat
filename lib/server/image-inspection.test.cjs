const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { inspectImage } = require('./image-inspection.cjs');
test('real decoders reject forged media and flag low resolution without rejecting valid dark pets', async () => {
  await assert.rejects(inspectImage(Buffer.from('not an image'), 'image/png'), { status: 400 });
  const png = await sharp({ create: { width: 128, height: 128, channels: 3, background: '#050505' } }).png().toBuffer();
  await assert.rejects(inspectImage(png, 'image/jpeg'), /格式/);
  const report = await inspectImage(png, 'image/png');
  assert.equal(report.width, 128);
  assert.ok(report.warnings.some((s) => s.includes('分辨率')));
  assert.ok(report.warnings.some((s) => s.includes('黑色宠物')));
  const white = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ffffff' } }).png().toBuffer();
  assert.ok((await inspectImage(white, 'image/png', true)).warnings.some((s) => s.includes('全白')));
});
