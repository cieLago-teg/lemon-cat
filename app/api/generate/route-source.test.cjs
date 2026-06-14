const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const routePath = path.join(process.cwd(), "app", "api", "generate", "route.ts");

test("generate route source keeps a complete POST handler and prompt parts", () => {
  const source = fs.readFileSync(routePath, "utf8");

  assert.match(source, /export async function POST\(request: Request\)/);
  assert.match(source, /const vibePart =/);
  assert.match(source, /const customPart =/);
  assert.match(source, /const combinedFeatures =/);
});
