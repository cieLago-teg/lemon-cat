#!/usr/bin/env node
/**
 * 把 59 个连通块启发式映射到 17 个 PARTS_01_xxx
 * 规则：基于位置（top/bottom/left/right/center）+ 大小
 */
const fs = require('fs');
const path = require('path');

const MAP_FILE = process.argv[2];
if (!MAP_FILE) { console.error('用法: node map-blocks-to-parts.cjs <atlas_region_map.json>'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const blocks = data.blocks;
const W = data.texture.width, H = data.texture.height;

// 启发式：基于位置 + 大小 + 形状分类
function classify(b) {
  const { center: c, bbox: bb, area } = b;
  const aspect = bb.w / bb.h;

  // 最大的（area > 500k）通常是 BODY 或 BACKGROUND
  if (area > 500000) return 'PARTS_01_BODY';

  // 又高又窄（aspect < 0.5）：tail（右侧长条）
  if (aspect < 0.55 && c.x > W * 0.6) return 'PARTS_01_TAIL';
  if (aspect < 0.55 && c.x < W * 0.4) return 'PARTS_01_ARM_L';  // 左前爪

  // 顶部（y < H*0.2）的靠左靠右：耳朵
  if (c.y < H * 0.3) {
    if (c.x < W * 0.3) return 'PARTS_01_EAR_001';   // 左耳区
    if (c.x > W * 0.7) return 'PARTS_01_EAR_001';   // 右耳区
  }

  // 底部（y > H*0.7）的宽长条：CHEST 或前爪
  if (c.y > H * 0.7) {
    if (bb.w > bb.h * 2) return 'PARTS_01_CHEST';   // 横向长条
    if (c.x < W * 0.5) return 'PARTS_01_ARM_L_02';  // 左前爪（后层）
    return 'PARTS_01_ARM_R_02';                       // 右前爪（后层）
  }

  // 中部小尺寸：面部零件
  if (area < 30000) {
    // 中心偏上：face / core
    if (c.y < H * 0.4) {
      if (aspect > 2) return 'PARTS_01_BROW_001';   // 眉毛（很宽很扁）
      return 'PARTS_01_CORE_001';                     // 脸核心
    }
    // 中心：eye
    if (c.x < W * 0.45) return 'PARTS_01_EYE_001';
    if (c.x > W * 0.55) return 'PARTS_01_EYE_001';

    // 中心偏下：nose / mouth
    if (c.y > H * 0.4) return 'PARTS_01_NOSE_001';
    return 'PARTS_01_MOUTH_001';
  }

  // 细长/线条：SKETCH（描边）
  if (aspect > 4 || aspect < 0.25) return 'PARTS_01_SKETCH';

  return 'PARTS_01_FACE_001';  // 默认归到脸部
}

const partToBlocks = {};
blocks.forEach(b => {
  const part = classify(b);
  if (!partToBlocks[part]) partToBlocks[part] = [];
  partToBlocks[part].push(b.index);
});

// 计算每个 part 的合并 bbox
const PART_DEFS = {
  PARTS_01_ARM_L:        { zh: '左前爪·前' },
  PARTS_01_ARM_L_02:     { zh: '左前爪·后' },
  PARTS_01_ARM_R:        { zh: '右前爪·前' },
  PARTS_01_ARM_R_02:     { zh: '右前爪·后' },
  PARTS_01_BACKGROUND:   { zh: '背景' },
  PARTS_01_BODY:         { zh: '身体' },
  PARTS_01_BROW_001:     { zh: '眉毛' },
  PARTS_01_CHEST:        { zh: '胸' },
  PARTS_01_CORE_001:     { zh: '脸核心' },
  PARTS_01_EAR_001:      { zh: '耳朵' },
  PARTS_01_EYE_001:      { zh: '眼睛' },
  PARTS_01_EYE_BALL_001: { zh: '瞳孔' },
  PARTS_01_FACE_001:     { zh: '脸底色' },
  PARTS_01_MOUTH_001:    { zh: '嘴' },
  PARTS_01_NOSE_001:     { zh: '鼻' },
  PARTS_01_SKETCH:       { zh: '描边' },
  PARTS_01_TAIL:         { zh: '尾巴' },
};

const regions = {};
for (const [part, def] of Object.entries(PART_DEFS)) {
  const blockIds = partToBlocks[part] || [];
  if (blockIds.length === 0) {
    regions[part] = { zh: def.zh, blocks: [], bbox: null, area: 0, confidence: 'none' };
    continue;
  }
  let minX = W, minY = H, maxX = 0, maxY = 0, totalArea = 0;
  for (const id of blockIds) {
    const b = blocks[id];
    if (b.bbox.x < minX) minX = b.bbox.x;
    if (b.bbox.y < minY) minY = b.bbox.y;
    if (b.bbox.x + b.bbox.w > maxX) maxX = b.bbox.x + b.bbox.w;
    if (b.bbox.y + b.bbox.h > maxY) maxY = b.bbox.y + b.bbox.h;
    totalArea += b.area;
  }
  regions[part] = {
    zh: def.zh,
    blocks: blockIds,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    area: totalArea,
    confidence: blockIds.length > 0 ? 'heuristic' : 'none',
  };
}

const out = {
  ...data,
  heuristicMapping: {
    method: 'position + size + aspect-ratio heuristic',
    note: '基于连通块的位置/大小/形状推断，可能有误差，需人工 review 可视化',
    regions,
  },
};

const outFile = MAP_FILE.replace('.json', '.mapped.json');
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`✅ 写入 ${outFile}`);
console.log('\n映射结果：');
for (const [part, info] of Object.entries(regions)) {
  const c = info.confidence === 'none' ? '⚠️ ' : '✅';
  const bbox = info.bbox ? `${info.bbox.w}×${info.bbox.h}@(${info.bbox.x},${info.bbox.y})` : 'NONE';
  console.log(`  ${c} ${part.padEnd(22)} (${info.zh.padEnd(6)}) blocks=${info.blocks.length} bbox=${bbox} area=${info.area}`);
}
