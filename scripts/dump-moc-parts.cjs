#!/usr/bin/env node
/**
 * 任何 .moc 文件 → 抽零件 ID
 * 原理：Cubism 2 规范规定 ID 必须是单字节字母数字下划线，最大 63 字符。
 *       官方约定前缀：PARTS_ / D_ / B_ / PARAM_
 * 用法：node scripts/dump-moc-parts.cjs <moc 文件>
 */
const fs = require('fs');
const path = require('path');

const RE = /[A-Za-z_][A-Za-z0-9_]{2,63}/g;
const PREFIXES = {
  PARTS_: 'parts',
  D_:     'drawables',
  B_:     'deformers',
  PARAM_: 'params',
};

function dump(filePath) {
  const buf = fs.readFileSync(filePath);
  const text = buf.toString('latin1');
  const seen = new Set();
  let m;
  while ((m = RE.exec(text)) !== null) {
    const s = m[0];
    for (const p of Object.keys(PREFIXES)) {
      if (s.startsWith(p)) { seen.add(s); break; }
    }
  }
  const out = { file: path.basename(filePath), size: buf.length, groups: { parts: [], drawables: [], deformers: [], params: [] } };
  for (const id of seen) {
    for (const p of Object.keys(PREFIXES)) {
      if (id.startsWith(p)) { out.groups[PREFIXES[p]].push(id); break; }
    }
  }
  for (const k of Object.keys(out.groups)) out.groups[k].sort();
  return out;
}

const target = process.argv[2];
if (!target) {
  console.error('用法: node dump-moc-parts.cjs <path/to/model.moc>');
  process.exit(1);
}
const result = dump(path.resolve(target));
console.log(JSON.stringify(result, null, 2));
