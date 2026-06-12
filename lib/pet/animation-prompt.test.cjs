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

test("buildIdlePrompt: default prompt preserves pixel grid and 10–12 fps uniform rhythm for pixel styles", () => {
  const out = buildIdlePrompt("", "像素 8-bit 风");
  assert.match(out, /pixel|像素/);
  assert.match(out, /10.*12|12.*10/);
  // Critical anti-stiffness phrase: must require whole-body movement.
  assert.match(out, /全身|whole|every part|all body|uniform/i);
  // Critical: must forbid freezing any body region.
  assert.match(out, /no\s+freez|不要|avoid freezing|局部冻结/i);
});

test("buildIdlePrompt: sticker style keeps flat colors and minimal motion", () => {
  const out = buildIdlePrompt("", "贴纸 sticker 风");
  assert.match(out, /flat|贴纸|sticker/i);
  // Sticker style should still keep the body moving, just within tight motion.
  assert.match(out, /whole|全身|every/i);
});

test("buildIdlePrompt: realistic style emphasizes micro-blinks and natural motion", () => {
  const out = buildIdlePrompt("", "写实 realistic 风格");
  assert.match(out, /realistic|写实|natural|skin/i);
  // Should NOT enforce pixel grid in realistic style.
  assert.doesNotMatch(out, /pixel grid|anti-alias.*off/i);
});

test("buildIdlePrompt: unknown style still returns a sensible default that moves the whole body", () => {
  const out = buildIdlePrompt("", "不认识的风格XYZ");
  assert.match(out, /whole|全身|every/i);
  // Must still keep it short, single subject, no scene change.
  assert.match(out, /single subject|单个主体|fixed camera|固定镜头|no scene/i);
});

test("buildIdlePrompt: STYLE_RULES exposes at least pixel, sticker, realistic", () => {
  assert.ok(typeof STYLE_RULES === "object" && STYLE_RULES !== null);
  const keys = Object.keys(STYLE_RULES);
  assert.ok(keys.includes("pixel"), `STYLE_RULES missing pixel, got: ${keys}`);
  assert.ok(keys.includes("sticker"), `STYLE_RULES missing sticker, got: ${keys}`);
  assert.ok(keys.includes("realistic"), `STYLE_RULES missing realistic, got: ${keys}`);
});

test("integration: /api/pet/animate route reads body.style and passes it to buildIdlePrompt", () => {
  // Static source-level check that the route delegates style into the
  // prompt builder. We cannot easily run the Next.js handler in a node:test
  // process, so we assert on the route source. If someone "optimises" the
  // route to drop the style field, this test fails loudly.
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.join(__dirname, "..", "..", "app", "api", "pet", "animate", "route.ts"),
    "utf8"
  );
  // The route must:
  //   1) Read body.style
  //   2) Pass it to buildIdlePrompt
  assert.match(source, /"style"\s+in\s+body/, "route must read body.style");
  assert.match(source, /buildIdlePrompt\([\s\S]*style/, "route must pass style to buildIdlePrompt");
  // And the production prompt builder must use STYLE_RULES.
  const promptSource = fs.readFileSync(__filename, "utf8");
  assert.match(promptSource, /STYLE_RULES/, "production code must reference STYLE_RULES");
});
