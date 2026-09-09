const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIdlePrompt,
  STYLE_RULES
} = require("./animation-prompt.js");

test("buildIdlePrompt: returns custom prompt verbatim when caller supplies one", () => {
  const custom = "完全由用户指定的提示词";
  const out = buildIdlePrompt(custom, "像素风");
  assert.equal(out, custom);
});

test("buildIdlePrompt: pixel style preserves grid and grounded pose without conflicting whole-body motion", () => {
  const out = buildIdlePrompt("", "像素 8-bit 风");
  assert.match(out, /pixel|像素/);
  assert.match(out, /feet.*stable|paws planted/i);
  assert.match(out, /breathing cycle|starting pose/);
  assert.doesNotMatch(out, /never freeze|every part should move|10.*12 fps/i);
});

test("buildIdlePrompt: sticker style keeps flat colors and minimal motion", () => {
  const out = buildIdlePrompt("", "贴纸 sticker 风");
  assert.match(out, /flat|贴纸|sticker/i);
  assert.match(out, /outline thickness/);
});

test("buildIdlePrompt: realistic style emphasizes micro-blinks and natural motion", () => {
  const out = buildIdlePrompt("", "写实 realistic 风格");
  assert.match(out, /realistic|写实|natural|skin/i);
  // Should NOT enforce pixel grid in realistic style.
  assert.doesNotMatch(out, /pixel grid|anti-alias.*off/i);
});

test("buildIdlePrompt: unknown style keeps subtle breathing and a fixed camera", () => {
  const out = buildIdlePrompt("", "不认识的风格XYZ");
  assert.match(out, /subtle breathing/);
  // Must still keep it short, single subject, no scene change.
  assert.match(out, /single subject|单个主体|fixed camera|固定镜头|no scene/i);
});

test('ink and collage preserve their distinct rendering materials', () => {
  assert.match(buildIdlePrompt('', '简约可爱水墨风'), /sparse ink strokes/);
  assert.match(buildIdlePrompt('', '和纸拼贴绘本风'), /cut-paper layers/);
});

test("buildIdlePrompt: STYLE_RULES exposes at least pixel, sticker, realistic", () => {
  assert.ok(typeof STYLE_RULES === "object" && STYLE_RULES !== null);
  const keys = Object.keys(STYLE_RULES);
  assert.ok(keys.includes("pixel"), `STYLE_RULES missing pixel, got: ${keys}`);
  assert.ok(keys.includes("sticker"), `STYLE_RULES missing sticker, got: ${keys}`);
  assert.ok(keys.includes("realistic"), `STYLE_RULES missing realistic, got: ${keys}`);
});

test("integration: animation worker passes persisted body.style to buildIdlePrompt", () => {
  // Static source-level check that the route delegates style into the
  // prompt builder. We cannot easily run the Next.js handler in a node:test
  // process, so we assert on the route source. If someone "optimises" the
  // route to drop the style field, this test fails loudly.
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "scripts", "worker.ts"),
    "utf8"
  );
  // The route must:
  //   1) Read body.style
  //   2) Pass it to buildIdlePrompt
  assert.match(source, /body\.style/, "worker must read persisted body.style");
  assert.match(source, /buildIdlePrompt\([\s\S]*style/, "route must pass style to buildIdlePrompt");
  // And the production prompt builder must use STYLE_RULES.
  const promptSource = fs.readFileSync(path.join(__dirname, 'animation-prompt.js'), "utf8");
  assert.match(promptSource, /STYLE_RULES/, "production code must reference STYLE_RULES");
});
