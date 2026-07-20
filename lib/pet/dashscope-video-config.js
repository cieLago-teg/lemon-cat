function resolveDashscopeVideoBaseUrl(env) {
  const source = env && typeof env === "object" ? env : {};
  const explicit = String(source.DASHSCOPE_VIDEO_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const bailianBaseUrl = String(source.BAILIAN_BASE_URL || "").trim();
  if (bailianBaseUrl) {
    try {
      const url = new URL(bailianBaseUrl);
      if (url.hostname === "dashscope.aliyuncs.com") {
        return "https://dashscope.aliyuncs.com/api/v1";
      }
      if (url.hostname === "dashscope-intl.aliyuncs.com") {
        return "https://dashscope-intl.aliyuncs.com/api/v1";
      }
      if (url.hostname === "dashscope-us.aliyuncs.com") {
        return "https://dashscope-us.aliyuncs.com/api/v1";
      }
    } catch {}
  }

  // 2026-07-15 Step 6.2：默认走国内版（dashscope.aliyuncs.com / 阿里云百炼）。
  // 旧默认是 dashscope-intl.aliyuncs.com（国际版），国内 API key 拿国际版
  // 端点会 401/无效。用户在 Railway 没设 BAILIAN_BASE_URL 时会直接失败。
  return "https://dashscope.aliyuncs.com/api/v1";
}

module.exports = {
  resolveDashscopeVideoBaseUrl
};
