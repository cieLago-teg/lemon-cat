/**
 * 集中管理项目的所有鉴权相关的配置和逻辑
 */

export const authConfig = {
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseUrl: process.env.BAILIAN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
  }
};

/**
 * 检查 API Key 是否配置
 * @param provider 鉴权提供方名称
 */
export function ensureAuth(provider: keyof typeof authConfig = 'dashscope') {
  const config = authConfig[provider];
  if (!config.apiKey) {
    throw new Error(`未配置 ${provider.toUpperCase()} 鉴权所需的 API Key`);
  }
  return config;
}
