const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routePath = path.join(process.cwd(), "app", "api", "generate", "route.ts");

test("generate route source keeps a complete POST handler and prompt parts", () => {
  const source = fs.readFileSync(routePath, "utf8");

  // 2026-09-08 1A 用户隔离：POST 改为 route() 包装（统一鉴权/错误处理）。
  assert.match(source, /export const POST = route\("POST", async \(request\) =>/);
  assert.match(source, /const vibePart =/);
  assert.match(source, /const customPart =/);
  assert.match(source, /const combinedFeatures =/);
});
