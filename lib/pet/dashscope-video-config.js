function resolveDashscopeVideoBaseUrl(env) {
  const source = env && typeof env === "object" ? env : {};
  const explicit = String(source.DASHSCOPE_VIDEO_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const bailianBaseUrl = String(source.BAILIAN_BASE_URL || "").trim();
  if (bailianBaseUrl) {
    const url = new URL(bailianBaseUrl);
    const official = ['dashscope.aliyuncs.com', 'dashscope-intl.aliyuncs.com', 'dashscope-us.aliyuncs.com'].includes(url.hostname) ||
      /^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(url.hostname);
    if (official && url.protocol === 'https:' && !url.username && !url.password && !url.port) return `${url.origin}/api/v1`;
    throw new Error('无法从 BAILIAN_BASE_URL 推导视频地域，请明确配置 DASHSCOPE_VIDEO_BASE_URL');
  }

  // 2026-07-15 Step 6.2：默认走国内版（dashscope.aliyuncs.com / 阿里云百炼）。
  // 旧默认是 dashscope-intl.aliyuncs.com（国际版），国内 API key 拿国际版
  // 端点会 401/无效。用户在 Railway 没设 BAILIAN_BASE_URL 时会直接失败。
  return "https://dashscope.aliyuncs.com/api/v1";
}

module.exports = {
  resolveDashscopeVideoBaseUrl
};
