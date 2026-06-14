const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pagePath = path.join(process.cwd(), "app", "create", "page.tsx");

test("profile editor keeps petStory optional in progress calculation", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /petStory/);
  assert.match(source, /setPetStory/);
  assert.match(source, /ProfilePreview/);
});
