const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routePath = path.join(process.cwd(), "app", "api", "generate", "route.ts");

test("generate route queues authenticated jobs and worker preserves prompt constraints", () => {
  const source = fs.readFileSync(routePath, "utf8");

  // 2026-09-08 1A 用户隔离：POST 改为 route() 包装（统一鉴权/错误处理）。
  assert.match(source, /requireUser\(request\)/);
  assert.match(source, /await enqueue/);
  assert.doesNotMatch(source, /await generateStyledImage/);
  const worker = fs.readFileSync(path.join(process.cwd(), 'scripts/worker.ts'), 'utf8');
  assert.match(worker, /buildPetImagePrompt\(template, body\)/);
});
