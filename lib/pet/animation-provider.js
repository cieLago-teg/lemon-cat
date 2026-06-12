// Single-provider availability for the AI animation feature.
// 历史回顾：之前项目同时支持 MiniMax (官方原生) 和 DashScope Wan，
// 2026-06-04 撤回了 MiniMax：价格太贵，且 Wan 完全够用。
// 此模块现在只导出 Wan 一家。

const ANIMATION_PROVIDER_ID = "dashscope_wan";

function getAnimationProviderAvailability(env) {
  const source = env && typeof env === "object" ? env : {};
  const dashscopeKey = String(source.DASHSCOPE_API_KEY || "").trim();
  return {
    dashscope_wan: {
      available: dashscopeKey.length > 0,
      envKey: "DASHSCOPE_API_KEY",
      reason: dashscopeKey.length > 0 ? "configured" : "missing_api_key"
    }
  };
}

module.exports = {
  ANIMATION_PROVIDER_ID,
  getAnimationProviderAvailability
};
