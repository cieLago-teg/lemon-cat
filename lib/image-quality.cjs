// 这些像素统计只能提示技术问题，不能判断宠物身份、主体数量或审美。
function pixelQuality(data, width, height, output = false) {
  let dark = 0, light = 0, white = 0, border = 0, borderForeground = 0, energy = 0;
  const values = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const k = y * width + x, i = k * 4;
    const a = data[i + 3] / 255;
    const r = data[i] * a + 255 * (1 - a), g = data[i + 1] * a + 255 * (1 - a), b = data[i + 2] * a + 255 * (1 - a);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    values[k] = l;
    dark += Number(l < 25); light += Number(l > 245);
    const blank = Math.min(r, g, b) > 245;
    white += Number(blank);
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { border++; borderForeground += Number(!blank); }
    if (x > 0 && y > 0) energy += Math.abs(l - values[k - 1]) + Math.abs(l - values[k - width]);
  }
  const n = width * height;
  const warnings = [];
  if (dark / n > 0.8) warnings.push('画面整体较暗，请确认毛色与眼睛细节可见（黑色宠物可能误触发）');
  if (!output && light / n > 0.9) warnings.push('画面偏亮或主体较小，请确认白色毛发细节没有丢失');
  if (!output && energy / n < 2) warnings.push('画面细节较少，可能模糊或主体过小，请肉眼确认');
  if (output && white / n > 0.98) warnings.push('画面接近全白，请确认宠物是否完整生成');
  if (output && borderForeground / border > 0.15) warnings.push('画面边缘存在色块，可能是背景不纯或主体被裁切');
  return { warnings, metrics: { darkRatio: dark / n, whiteRatio: white / n, borderForegroundRatio: borderForeground / border } };
}
module.exports = { pixelQuality };
