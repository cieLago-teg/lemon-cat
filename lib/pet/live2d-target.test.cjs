const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { getLive2DStatus, resolveLive2DModelTarget } = require("./live2d-target.js");

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pet-live2d-"));
}

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{}", "utf8");
}

test("reports sample-only status when only shizuku exists", () => {
  const root = makeTempProject();
  ensureFile(path.join(root, "desktop-pet-shell", "models", "shizuku", "runtime", "shizuku.model3.json"));

  const status = getLive2DStatus(root);

  assert.equal(status.available, false);
  assert.equal(status.source, "sample_only");
  assert.match(status.message, /示例 Live2D 模型/);
});

test("resolves custom model target when a custom model exists", () => {
  const root = makeTempProject();
  ensureFile(path.join(root, "desktop-pet-shell", "models", "custom", "runtime", "cat.model3.json"));

  const target = resolveLive2DModelTarget(root);

  assert.deepEqual(target, {
    ok: true,
    source: "custom",
    config: {
      mode: "live2d",
      baseUrl: "./models/custom/runtime/cat.model3.json"
    }
  });
});

test("refuses to deploy sample model as the user's pet", () => {
  const root = makeTempProject();
  ensureFile(path.join(root, "desktop-pet-shell", "models", "shizuku", "runtime", "shizuku.model3.json"));

  const target = resolveLive2DModelTarget(root);

  assert.equal(target.ok, false);
  assert.equal(target.reason, "sample_only");
  assert.match(target.message, /示例 Live2D 模型/);
});
