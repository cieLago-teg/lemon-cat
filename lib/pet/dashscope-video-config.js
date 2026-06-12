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

  return "https://dashscope-intl.aliyuncs.com/api/v1";
}

module.exports = {
  resolveDashscopeVideoBaseUrl
};
