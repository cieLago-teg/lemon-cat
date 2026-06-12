const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createPetShellBridge,
  getRuntimeScriptUrls,
  normalizeConfig
} = require("./runtime-helpers.js");

test("static and frames modes do not request Live2D runtime scripts", () => {
  assert.deepEqual(getRuntimeScriptUrls("static"), []);
  assert.deepEqual(getRuntimeScriptUrls("frames"), []);
  assert.deepEqual(getRuntimeScriptUrls("gif"), []);
});

test("live2d mode requests runtime scripts in deterministic order", () => {
  assert.deepEqual(getRuntimeScriptUrls("live2d"), [
    "./lib/live2dcubismcore.min.js",
    "./lib/pixi.min.js",
    "./lib/pixi-live2d-display.min.js"
  ]);
});

test("missing preload bridge falls back to safe static defaults", async () => {
  const bridge = createPetShellBridge(undefined);

  assert.deepEqual(await bridge.readConfig(), { mode: "static", src: "./pet.png" });
  assert.deepEqual(await bridge.getState(), { clickThrough: false });

  assert.doesNotThrow(() => bridge.toggleClickThrough());
  assert.doesNotThrow(() => bridge.moveWindow(12, 8));
  assert.doesNotThrow(() => bridge.toggleDevTools());
  assert.doesNotThrow(() => bridge.quit());
  assert.equal(bridge.onClickThroughChanged(() => {}), false);
  assert.equal(bridge.onReload(() => {}), false);
});

test("normalizeConfig keeps static mode resilient", () => {
  assert.deepEqual(normalizeConfig(null), { mode: "static", src: "./pet.png" });
  assert.deepEqual(normalizeConfig({ mode: "static", src: "pet.png" }), {
    mode: "static",
    src: "./pet.png"
  });
  assert.deepEqual(normalizeConfig({ mode: "video", src: "pet-video.mp4" }), {
    mode: "video",
    src: "./pet-video.mp4"
  });
  assert.deepEqual(normalizeConfig({ mode: "live2d" }), {
    mode: "live2d",
    baseUrl: "./models/shizuku/runtime/shizuku.model3.json"
  });
});

test("normalizeConfig recognises static/video/live2d modes", () => {
  // APNG 桌宠已撤回（2026-06-04）：项目不再支持 animated_image 模式。
  // 静态、动图/视频、Live2D 仍是合法 mode。
  assert.deepEqual(normalizeConfig({ mode: "static", src: "pet.png" }), {
    mode: "static",
    src: "./pet.png"
  });
  assert.deepEqual(normalizeConfig({ mode: "video", src: "pet-video.mp4" }), {
    mode: "video",
    src: "./pet-video.mp4"
  });
  assert.deepEqual(normalizeConfig({ mode: "live2d" }), {
    mode: "live2d",
    baseUrl: "./models/shizuku/runtime/shizuku.model3.json"
  });
});

test("normalizeConfig rejects animated_image (APNG 桌宠已撤回)", () => {
  // APNG 桌宠方案已撤回，animated_image 不再是合法 mode，
  // 应回退到默认的 static。
  const cfg = normalizeConfig({ mode: "animated_image", src: "pet-animated.png" });
  assert.equal(cfg.mode, "static");
});
