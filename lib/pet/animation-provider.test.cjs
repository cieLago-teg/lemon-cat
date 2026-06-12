const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ANIMATION_PROVIDER_ID,
  getAnimationProviderAvailability
} = require("./animation-provider.js");

test("ANIMATION_PROVIDER_ID is locked to 'dashscope_wan' (MiniMax 已撤回)", () => {
  // 历史回顾：以前项目同时支持 "replicate_minimax" 和 "dashscope_wan"，
  // 2026-06-04 撤回了 MiniMax（价格太贵），现在只剩 Wan 一家。
  // 这个守卫测试防止以后有人手滑把 MiniMax 加回来。
  assert.equal(ANIMATION_PROVIDER_ID, "dashscope_wan");
});

test("getAnimationProviderAvailability reports missing DASHSCOPE_API_KEY", () => {
  const availability = getAnimationProviderAvailability({});
  assert.deepEqual(availability, {
    dashscope_wan: {
      available: false,
      envKey: "DASHSCOPE_API_KEY",
      reason: "missing_api_key"
    }
  });
});

test("getAnimationProviderAvailability marks dashscope_wan available when key is set", () => {
  const availability = getAnimationProviderAvailability({
    DASHSCOPE_API_KEY: "sk-xxx"
  });
  assert.deepEqual(availability, {
    dashscope_wan: {
      available: true,
      envKey: "DASHSCOPE_API_KEY",
      reason: "configured"
    }
  });
});

test("getAnimationProviderAvailability ignores legacy MiniMax / Replicate keys", () => {
  // 即便 env 里残留了 MiniMax / Replicate 的 key，Wan 的 availability
  // 也不应该被影响——它只看 DASHSCOPE_API_KEY。
  const availability = getAnimationProviderAvailability({
    MINIMAX_API_KEY: "sk-minimax",
    REPLICATE_API_TOKEN: "r8_xxx"
  });
  assert.equal(availability.dashscope_wan.available, false);
  assert.equal(availability.dashscope_wan.envKey, "DASHSCOPE_API_KEY");
});
