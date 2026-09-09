// 微动作优先：全身同时移动会增加形变。文字只表达循环意图，不能保证帧级闭环。
const LOOP_RULES = [
  "One gentle breathing cycle, returning gradually to the starting pose for a seamless loop.",
  "Keep paws planted and body position stable; a brief soft blink is enough secondary motion.",
  "Fixed camera, no camera motion, no zoom, no pan, no parallax drift.",
  "Small amplitude; no jumping, walking, turning around or whole-body stretching.",
  "Preserve the source markings, silhouette, colors, lighting and plain background throughout.",
  "No scene change, no background change, no new elements, no morphing."
];

const STYLE_RULES = {
  pixel: {
    matchers: ["pixel", "8-bit", "16-bit", "像素", "点阵"],
    extra: [
      "Preserve the original pixel grid strictly: do not anti-alias or smooth the pixels.",
      "Lock the palette and chunky pixel blocks exactly as in the source image.",
      "Use a few crisp sprite-like pose changes for breathing; keep the feet and pixel-block scale stable."
    ]
  },
  sticker: {
    matchers: ["贴纸", "sticker"],
    extra: [
      "Keep flat colors and hard edges; do not introduce shading, gradients, or anti-aliasing.",
      "Preserve the outline thickness during subtle breathing; keep the paws anchored."
    ]
  },
  realistic: {
    matchers: ["写实", "realistic", "真实"],
    extra: [
      "Use natural-looking motion: micro-blinks, soft breathing, gentle tail sway, subtle ear twitch.",
      "Skin, fur and shadows should look natural and slightly soft; do not over-sharpen.",
      "Single subject, fixed camera, stable composition, no scene change."
    ]
  },
  ink: {
    matchers: ["水墨", "ink"],
    extra: ["Preserve sparse ink strokes and pale color patches; do not grow new fur details or spreading ink."]
  },
  collage: {
    matchers: ["和纸", "拼贴", "collage"],
    extra: ["Preserve the cut-paper layers and their hard edges; paper shapes move together without melting or fluttering."]
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
    lines.push("Preserve the source illustration style during subtle breathing and a soft blink.");
  }
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
