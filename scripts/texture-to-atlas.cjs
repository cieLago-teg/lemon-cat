#!/usr/bin/env node
/**
 * 直接对贴图 PNG 做连通块分析
 * 输出：atlas_region_map.json
 * 原理：扫描非透明像素 → 4-邻接连通块 → 每个块 = 一个零件
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'node_modules', 'pngjs')) || require('pngjs');

const TEXTURE = process.argv[2];
const OUT = process.argv[3];
if (!TEXTURE) { console.error('用法: node texture-to-atlas.cjs <texture.png> [out.json]'); process.exit(1); }

const png = PNG.sync.read(fs.readFileSync(TEXTURE));
const { width, height, data } = png;
console.log(`贴图: ${width}x${height}, ${data.length/1024/1024|0}MB`);

// 找非透明像素的连通块（4 邻接）
const visited = new Uint8Array(width * height);
const blocks = [];

// 用 BFS 找连通块
function getBlock(sx, sy) {
  const stack = [[sx, sy]];
  let minX = sx, maxX = sx, minY = sy, maxY = sy;
  let count = 0;
  const pixels = [];
  while (stack.length) {
    const [x, y] = stack.pop();
    const idx = y * width + x;
    if (visited[idx]) continue;
    const a = data[idx * 4 + 3];
    if (a < 10) continue;
    visited[idx] = 1;
    count++;
    pixels.push([x, y]);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x > 0)   stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0)   stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }
  return { minX, minY, maxX, maxY, count, pixels };
}

let t0 = Date.now();
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * width + x;
    if (visited[idx]) continue;
    if (data[idx * 4 + 3] < 10) { visited[idx] = 1; continue; }
    const block = getBlock(x, y);
    if (block.count > 50) blocks.push(block); // 忽略噪点
  }
}
console.log(`找到 ${blocks.length} 个连通块，耗时 ${Date.now() - t0}ms`);

// 排序：按面积降序
blocks.sort((a, b) => b.count - a.count);

const out = {
  texture: { path: TEXTURE, width, height },
  generatedAt: new Date().toISOString(),
  method: '4-connectivity flood fill on non-transparent pixels',
  totalBlocks: blocks.length,
  blocks: blocks.map((b, i) => ({
    index: i,
    bbox: { x: b.minX, y: b.minY, w: b.maxX - b.minX + 1, h: b.maxY - b.minY + 1 },
    center: { x: ((b.minX + b.maxX) / 2) | 0, y: ((b.minY + b.maxY) / 2) | 0 },
    area: b.count,
    fillRatio: (b.count / ((b.maxX - b.minX + 1) * (b.maxY - b.minY + 1))).toFixed(3),
  })),
};

const outPath = OUT || path.join(path.dirname(TEXTURE), 'atlas_region_map.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`✅ 写入 ${outPath}`);
console.log('前 10 大块：');
out.blocks.slice(0, 10).forEach(b => {
  console.log(`  #${b.index}: bbox=(${b.bbox.x},${b.bbox.y}) ${b.bbox.w}×${b.bbox.h} · area=${b.area.toLocaleString()} · center=(${b.center.x},${b.center.y})`);
});
