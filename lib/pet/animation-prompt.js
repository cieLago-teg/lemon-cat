// Style-aware idle prompt builder for the Wan (DashScope) video generation
// pipeline. The default prompt is intentionally "full-body, uniform rhythm"
// to avoid the most common visual artifact: an I2V model freezing most of
// the character and animating only one or two regions (eye blink, tail tip).
// Each style in STYLE_RULES appends constraints that lock the model to the
// visual language of that style (e.g. pixel grid for pixel art, flat colors
// for stickers).

// 2026-06-12 Loop-fix 关键约束：Wan 2.6 flash 是单帧 I2V，没有原生 first+last 帧。
// 但社区共识是把同一张图当首尾 + 在 prompt 里写"seamless loop" 可以让模型产出
// "看起来连贯"的循环视频。下面这一组规则统一收集了"必须 cyclic、必须
// returns to start、必须 small amplitude、必须 static composition"。
// 这样生成出来的视频循环点不会突然抽搐，体验上更接近"一直在呼吸的小动物"。
const LOOP_RULES = [
  "Seamless loop: the final frame must visually match the first frame.",
  "Cyclic motion only — breathing in and out, slow tail sway, gentle blink, ear twitch.",
  "The subject must end in the EXACT same pose and position it started.",
  "Fixed camera, no camera motion, no zoom, no pan, no parallax drift.",
  "Small amplitude (1-3 pixels of movement); no big gestures, no jumping, no walking.",
  "Continuous, repetitive rhythm; never freeze any body part.",
  "Avoid lighting shifts, color drift, contrast drift between frames.",
  "No scene change, no background change, no new elements, no morphing."
];

const STYLE_RULES = {
  pixel: {
    matchers: ["pixel", "8-bit", "16-bit", "像素", "点阵"],
    extra: [
      "Preserve the original pixel grid strictly: do not anti-alias or smooth the pixels.",
      "Lock the palette and chunky pixel blocks exactly as in the source image.",
      "Animate the WHOLE body in a small, uniform rhythm at ~10–12 fps.",
      "Keep amplitude to 1–3 pixels so the pixelation is preserved.",
      "Every part should move a little: breathing, slow tail sway, occasional blink, one ear twitch, slight head bob.",
      "Avoid freezing any body region; the motion must be whole-body, not single-part."
    ]
  },
  sticker: {
    matchers: ["贴纸", "sticker"],
    extra: [
      "Keep flat colors and hard edges; do not introduce shading, gradients, or anti-aliasing.",
      "Animate the WHOLE body in a small, uniform rhythm at ~10–12 fps.",
      "Keep amplitude small but every part should move: breathing, slow tail sway, blink, ear twitch.",
      "Avoid freezing any body region; the motion must be whole-body, not single-part."
    ]
  },
  realistic: {
    matchers: ["写实", "realistic", "真实"],
    extra: [
      "Use natural-looking motion: micro-blinks, soft breathing, gentle tail sway, subtle ear twitch.",
      "Skin, fur and shadows should look natural and slightly soft; do not over-sharpen.",
      "Single subject, fixed camera, stable composition, no scene change."
    ]
  }
};

const COMMON_BASE = [
  "Single subject, fixed camera, stable composition.",
  "No scene change, no new limbs, no morphing, no head turn.",
  "Suitable for a seamless desktop pet loop."
];

function detectStyleKey(styleHint) {
  const hint = String(styleHint || "").toLowerCase();
  if (!hint) return null;
  for (const [key, rule] of Object.entries(STYLE_RULES)) {
    if (rule.matchers.some((m) => hint.includes(m.toLowerCase()))) {
      return key;
    }
  }
  return null;
}

function buildDefaultPrompt(styleHint) {
  const styleKey = detectStyleKey(styleHint);
  const rule = styleKey ? STYLE_RULES[styleKey] : null;
  const lines = [];
  if (rule) {
    lines.push(...rule.extra);
  } else {
    // Generic fallback: still anti-stiffness.
    lines.push(
      "Animate the WHOLE body in a small, uniform rhythm at ~10–12 fps.",
      "Keep amplitude small but every part should move: breathing, slow tail sway, blink, ear twitch, head bob.",
      "Avoid freezing any body region; the motion must be whole-body, not single-part."
    );
  }
  // Loop fix: 把"首尾必须一致"的硬约束放到 COMMON_BASE 之前，让它在 prompt
  // 中段就出现，模型注意力的覆盖更高。
  lines.push(...LOOP_RULES);
  lines.push(...COMMON_BASE);
  return lines.join(" ");
}

function buildIdlePrompt(input, styleHint) {
  const custom = String(input || "").trim();
  if (custom) return custom;
  return buildDefaultPrompt(styleHint);
}

module.exports = {
  STYLE_RULES,
  detectStyleKey,
  buildDefaultPrompt,
  buildIdlePrompt
};
