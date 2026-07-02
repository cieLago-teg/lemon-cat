#!/usr/bin/env node
/**
 * 高级连通块分析：分离小元素 + 输出每块独立 PNG
 * 用法：node texture-elements.cjs <texture.png> <out_dir>
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const TEXTURE = process.argv[2];
const OUT_DIR = process.argv[3];
if (!TEXTURE || !OUT_DIR) { console.error('用法: node texture-elements.cjs <texture.png> <out_dir>'); process.exit(1); }

const png = PNG.sync.read(fs.readFileSync(TEXTURE));
const { width, height, data } = png;
console.log(`贴图: ${width}x${height}`);

const PAD = 32;            // 周围留白像素（让元素"拉开间距"）
const MIN_AREA = 50;       // 最小保留面积
const MAX_DIM = 256;       // 单个 PNG 最大尺寸

// 1) 4-邻接连通块
const visited = new Uint8Array(width * height);
const blocks = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * width + x;
    if (visited[idx]) continue;
    if (data[idx * 4 + 3] < 10) { visited[idx] = 1; continue; }
    const stack = [[x, y]];
    let minX = x, maxX = x, minY = y, maxY = y, count = 0;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const ci = cy * width + cx;
      if (visited[ci]) continue;
      const a = data[ci * 4 + 3];
      if (a < 10) continue;
      visited[ci] = 1;
      count++;
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
      if (cx > 0)         stack.push([cx - 1, cy]);
      if (cx < width - 1) stack.push([cx + 1, cy]);
      if (cy > 0)         stack.push([cx, cy - 1]);
      if (cy < height - 1) stack.push([cx, cy + 1]);
    }
    if (count >= MIN_AREA) blocks.push({ minX, minY, maxX, maxY, count });
  }
}
console.log(`找到 ${blocks.length} 个元素`);

// 2) 每个元素输出独立 PNG（带 padding，"拉开间距"）
fs.mkdirSync(OUT_DIR, { recursive: true });
blocks.sort((a, b) => b.count - a.count);

const out = {
  texture: { path: TEXTURE, width, height },
  generatedAt: new Date().toISOString(),
  totalElements: blocks.length,
  elements: [],
};

blocks.forEach((b, i) => {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  // 计算目标尺寸：等比缩放到 MAX_DIM 内，留 PAD
  const scale = Math.min(1, MAX_DIM / Math.max(w + 2 * PAD, h + 2 * PAD));
  const dstW = Math.max(64, Math.round((w + 2 * PAD) * scale));
  const dstH = Math.max(64, Math.round((h + 2 * PAD) * scale));
  const out_png = new PNG({ width: dstW, height: dstH });
  // 透明背景（已默认）
  // 把原图复制到新图，源 = (b.minX - PAD, b.minY - PAD)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcX = b.minX + x, srcY = b.minY + y;
      const srcI = (srcY * width + srcX) * 4;
      const dstX = Math.round(PAD * scale) + Math.round(x * scale);
      const dstY = Math.round(PAD * scale) + Math.round(y * scale);
      if (dstX < dstW && dstY < dstH) {
        const dstI = (dstY * dstW + dstX) * 4;
        out_png.data[dstI]     = data[srcI];
        out_png.data[dstI + 1] = data[srcI + 1];
        out_png.data[dstI + 2] = data[srcI + 2];
        out_png.data[dstI + 3] = data[srcI + 3];
      }
    }
  }
  const filename = `el_${String(i).padStart(3, '0')}_w${w}h${h}_a${b.count}.png`;
  fs.writeFileSync(path.join(OUT_DIR, filename), PNG.sync.write(out_png));
  out.elements.push({
    index: i,
    filename,
    bbox: { x: b.minX, y: b.minY, w, h },
    area: b.count,
    name: null,            // 用户手动命名
    partId: null,          // 关联到 PARTS_01_xxx
  });
});

const outFile = path.join(OUT_DIR, 'elements.json');
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`✅ ${blocks.length} 个独立 PNG + elements.json → ${OUT_DIR}`);
