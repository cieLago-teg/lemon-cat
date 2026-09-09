import { ensureAuth } from "./auth";
import { Agent, fetch as undiciFetch } from "undici";
import { createRequire } from 'node:module';
import type { ServiceLogger } from './server/logger.cjs';
const logger = createRequire(process.cwd() + '/package.json')('./lib/server/logger.cjs').logger as ServiceLogger;


// 2026-06-04 修复：手机热点 / DoH DNS 下首次解析 dashscope.aliyuncs.com
// 可能要 22 秒，undici 默认 connectTimeout 只有 10s，会在握手阶段抛
// UND_ERR_CONNECT_TIMEOUT。这里给所有发往 dashscope 的 fetch 配一个
// 60s 的连接/请求超时，覆盖任何 DNS 冷启动场景。
//
// 注意：
// 1. signal-based 的 AbortController 不能延长 connectTimeout
//    （它只 abort 已开始的等待），必须通过 dispatcher 才能根治。
// 2. globalThis.fetch 的 RequestInit 类型是 DOM 版本，不认 dispatcher；
//    所以这里统一走 undici 自己的 fetch，类型 + 行为一致。
let _dashscopeAgent: Agent | null = null;
function getDashscopeAgent() {
  if (!_dashscopeAgent) {
    _dashscopeAgent = new Agent({
      connectTimeout: 60_000,   // TCP 握手最多 60s（undici 默认 10s 不够）
      headersTimeout: 60_000,   // 等响应头最多 60s
      bodyTimeout: 5 * 60_000,  // 读 body 最多 5 分钟
      keepAliveTimeout: 30_000
    });
  }
  return _dashscopeAgent;
}

export { getDashscopeAgent };

// undici 的 Response 和 DOM Response 在 ReadableStream 泛型上有差异，
// 但运行时行为完全一致。这里统一强转为 DOM Response，方便后续 .text()
// .ok .status 的消费代码不动。
type DomResponse = Response;

async function bailianFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { baseUrl, apiKey } = ensureAuth('dashscope');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s 总超时

  let response: DomResponse;
  try {
    response = (await undiciFetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // 关键：用自定义 dispatcher 把 connectTimeout 从 10s 拉到 60s，
      // 否则在 DoH / 跨网 DNS 场景下会被 undici 内部 timeout 干死。
      dispatcher: getDashscopeAgent()
    })) as unknown as DomResponse;
  } catch (err) {
    throw new Error('百炼请求传输失败，提交结果需核对', { cause: err });
  } finally {
    clearTimeout(timeoutId);
  }

  let data: Record<string, unknown> = {};
  const text = await response.text();

  logger.info({ path, status: response.status }, 'provider response');

  try {
    if (text) {
      data = JSON.parse(text) as Record<string, unknown>;
    }
  } catch (err) {
    throw new Error(`百炼接口返回非JSON格式: ${response.status}`, { cause: err });
  }

  if (!response.ok) {
    const errorObj = data.error as Record<string, unknown> | undefined;
    const message = (errorObj?.message as string) ?? (data.message as string) ?? `百炼请求失败 (${response.status})`;
    throw new Error(message);
  }
  return data as unknown as T;
}

function getDashscopeRoot() {
  const { baseUrl } = ensureAuth('dashscope');
  if (baseUrl.includes("/compatible-mode/")) {
    return baseUrl.split("/compatible-mode/")[0];
  }
  if (baseUrl.endsWith("/v1")) {
    return baseUrl.slice(0, -3);
  }
  return baseUrl;
}

async function delay(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isNetworkOrRateLimitError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("fetch failed") ||
    lower.includes("econnreset") ||
    lower.includes("timeout") ||
    lower.includes("network")
  );
}

async function withRetry<T>(runner: () => Promise<T>, attempts = 1) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await runner();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!isNetworkOrRateLimitError(message) || i === attempts - 1) {
        throw error;
      }
      await delay(1200 * (i + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("请求失败");
}


type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type ImageGenerationResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
};

type DashscopeMultimodalGenerationResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; text?: string; type?: string }>;
      };
    }>;
  };
  message?: string;
  code?: string;
};

function normalizePetFeatures(content: string) {
  const trimmed = content.trim();
  // 去掉可能包含的 json 代码块标记或者类似 "输出：" 的前缀
  const cleaned = trimmed.replace(/^输出：/g, "").replace(/^```json/g, "").replace(/```$/g, "").trim();
  return Array.from(cleaned).slice(0, 150).join("");
}

export async function extractPetFeatures(imageBase64WithMime: string, model: string, systemPrompt: string) {
  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          { type: "text", text: "提取这只宠物的可用于绘图的关键外观特征。" },
          {
            type: "image_url",
            image_url: {
              url: imageBase64WithMime
            }
          }
        ]
      }
    ]
  };
  const response = await withRetry(() => bailianFetch<ChatCompletionResponse>("/chat/completions", payload));
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return normalizePetFeatures(content);
  }
  if (Array.isArray(content)) {
    const merged = content.map((item) => item.text ?? "").join("").trim();
    if (merged) {
      return normalizePetFeatures(merged);
    }
  }
  throw new Error("特征提取结果为空");
}

export async function generatePetImage(prompt: string, source: string, model: string) {
  if (!/^qwen-image-edit-(plus|max)(-\d{4}-\d{2}-\d{2})?$/.test(model)) throw new Error('宠物图生图需要 Qwen Image Edit Plus/Max 模型');
  return runSyncMultimodalImageGeneration(`保持参考图中同一只宠物的身份：保留独有毛色与花纹位置、脸型、耳型、眼睛特征。只改变绘画风格，不替换成同品种其他宠物。\n${prompt}`, model, '1024*1024', source);
}

export async function generateStyledImage(prompt: string, model: string) {
  // 2026-08-07：wan2.6 系列改走同步多模态生成协议（runSyncMultimodalImageGeneration）。
  // 根因：异步任务（runAsyncImageTask）返回的结果 URL 存放在 dashscope-result-*
  // 内网专用桶，公网（浏览器 / Railway 服务器 / i2v 拉图 worker）一律 403，
  // 直接导致"生成宠物动态形象"最后一步 i2v 拉不到参考图而失败。
  // 同步协议返回 oss-accelerate 公共加速桶 URL，公网可直接下载，
  // 官方文档也推荐大多数场景使用同步调用。
  if (model.startsWith("wan")) {
    return withRetry(() => runSyncMultimodalImageGeneration(prompt, model, "1280*1280"));
  }

  if (model.startsWith("qwen-image") || model.startsWith("qwen_image")) {
    return withRetry(() => runSyncMultimodalImageGeneration(prompt, model));
  }

  try {
    const payload = {
      model,
      prompt,
      size: "1024*1024",
      response_format: "url"
    };
    const response = await withRetry(() => bailianFetch<ImageGenerationResponse>("/images/generations", payload));
    const image = response.data?.[0];
    if (!image) {
      throw new Error("图片生成结果为空");
    }
    if (image.url) {
      return image.url;
    }
    if (image.b64_json) {
      return `data:image/png;base64,${image.b64_json}`;
    }
  } catch (error) {
    logger.error({ err: error, model }, 'image generation failed; no fallback submission');
    throw error;
  }

  throw new Error('图片生成结果为空，提交结果需核对');
}

  async function runSyncMultimodalImageGeneration(prompt: string, model: string, size = "1024*1024", source?: string) {
    const { apiKey } = ensureAuth('dashscope');
    const url = `${getDashscopeRoot()}/api/v1/services/aigc/multimodal-generation/generation`;
    // wan2.6 专属参数：关闭扩写与水印，保证结果图贴合 prompt 且无水印。
    // qwen-image 不识别这些字段，故仅在 wan 前缀下附加，避免误伤。
    const parameters: Record<string, unknown> = { size, n: 1 };
    if (model.startsWith("wan")) {
      parameters.prompt_extend = false;
      parameters.watermark = false;
    }
    let response: DomResponse;
    try {
      // 2026-06-04：补上 dispatcher，把 undici 默认 10s connectTimeout
      // 拉到 60s，覆盖 DoH / 手机热点下的冷启动 DNS 慢场景。
      response = (await undiciFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        dispatcher: getDashscopeAgent(),
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [...(source ? [{ image: source }] : []), { text: prompt }]
            }
          ]
        },
        parameters
      })
    })) as unknown as DomResponse;
  } catch (err) {
    const cause =
      err && typeof err === "object" && "cause" in err ? (err as { cause?: unknown }).cause : undefined;
    const causeHint = (() => {
      if (!cause || typeof cause !== "object") return "";
      const code = "code" in cause ? (cause as { code?: unknown }).code : undefined;
      const message = "message" in cause ? (cause as { message?: unknown }).message : undefined;
      const codeText = typeof code === "string" ? code : "";
      const messageText = typeof message === "string" ? message : String(cause);
      return ` | cause=${codeText}${codeText ? ":" : ""}${messageText}`;
    })();
    throw new Error(`百炼请求传输失败，提交结果需核对${causeHint}`, { cause: err });
  }
  const text = await response.text();
  let data: DashscopeMultimodalGenerationResponse = {};
  try {
    if (text) {
      data = JSON.parse(text) as DashscopeMultimodalGenerationResponse;
    }
  } catch {
    throw new Error(`百炼多模态生图返回非JSON: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(data.message ?? data.code ?? `百炼多模态生图失败 (${response.status})`);
  }
  const imageUrl = data.output?.choices?.[0]?.message?.content?.find((item) => typeof item.image === "string")?.image;
  if (!imageUrl) {
    throw new Error("多模态生图结果为空");
  }
  return imageUrl;
}
