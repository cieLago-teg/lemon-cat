const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveDashscopeVideoBaseUrl } = require("./dashscope-video-config.js");

test('workspace-specific endpoints keep the same region; invalid config fails visibly', () => {
  assert.equal(resolveDashscopeVideoBaseUrl({ BAILIAN_BASE_URL: 'https://workspace123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' }), 'https://workspace123.cn-beijing.maas.aliyuncs.com/api/v1');
  assert.throws(() => resolveDashscopeVideoBaseUrl({ BAILIAN_BASE_URL: 'bad-url' }));
  assert.throws(() => resolveDashscopeVideoBaseUrl({ BAILIAN_BASE_URL: 'https://example.com/v1' }), /DASHSCOPE_VIDEO_BASE_URL/);
});

test("prefers explicit DASHSCOPE_VIDEO_BASE_URL", () => {
  assert.equal(
    resolveDashscopeVideoBaseUrl({
      DASHSCOPE_VIDEO_BASE_URL: "https://example.com/api/v1",
      BAILIAN_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }),
    "https://example.com/api/v1"
  );
});

test("maps China compatible endpoint to native China video endpoint", () => {
  assert.equal(
    resolveDashscopeVideoBaseUrl({
      BAILIAN_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }),
    "https://dashscope.aliyuncs.com/api/v1"
  );
});

test("maps intl compatible endpoint to native intl video endpoint", () => {
  assert.equal(
    resolveDashscopeVideoBaseUrl({
      BAILIAN_BASE_URL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    }),
    "https://dashscope-intl.aliyuncs.com/api/v1"
  );
});
