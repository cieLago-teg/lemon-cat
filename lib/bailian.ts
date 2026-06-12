import { ensureAuth } from "./auth";
import { Agent, fetch as undiciFetch } from "undici";

const { baseUrl, apiKey } = ensureAuth('dashscope');

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

// undici 的 Response 和 DOM Response 在 ReadableStream 泛型上有差异，
// 但运行时行为完全一致。这里统一强转为 DOM Response，方便后续 .text()
// .ok .status 的消费代码不动。
type DomResponse = Response;

async function bailianFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
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
    throw new Error(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  let data: Record<string, unknown> = {};
  const text = await response.text();

  console.log(`[Bailian API] Path: ${path} | Status: ${response.status}`);
  if (!response.ok) {
    console.log(`[Bailian API Error] Response: ${text.slice(0, 500)}`);
  }

  try {
    if (text) {
      data = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    throw new Error(`百炼接口返回非JSON格式: ${response.status} ${text.slice(0, 100)}`);
  }

  if (!response.ok) {
    const errorObj = data.error as Record<string, unknown> | undefined;
    const message = (errorObj?.message as string) ?? (data.message as string) ?? `百炼请求失败 (${response.status})`;
    throw new Error(message);
  }
  return data as unknown as T;
}

function getDashscopeRoot() {
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

async function withRetry<T>(runner: () => Promise<T>, attempts = 3) {
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

type DashscopeTaskCreateResponse = {
  output?: {
    task_id?: string;
    results?: Array<{ url?: string }>;
    result_url?: string;
  };
  message?: string;
  code?: string;
};

type DashscopeTaskQueryResponse = {
  output?: {
    task_status?: string;
    results?: Array<{ url?: string }>;
    result_url?: string;
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; type?: string }>;
      };
    }>;
    message?: string;
  };
  message?: string;
  code?: string;
};

async function createImageTask(prompt: string, model: string) {
  let servicePath = "/api/v1/services/aigc/text2image/image-synthesis";
  let inputPayload: unknown = { prompt };
  let size = "1024*1024";

  if (model.startsWith("wan2.6")) {
    servicePath = "/api/v1/services/aigc/image-generation/generation";
    inputPayload = {
      messages: [
        {
          role: "user",
          content: [{ text: prompt }]
        }
      ]
    };
    size = "1280*1280"; // wan2.6 的约束
  } else if (model.startsWith("qwen-image") || model.startsWith("qwen_image")) {
    servicePath = "/api/v1/services/aigc/multimodal-generation/generation";
    inputPayload = {
      messages: [
        {
          role: "user",
          content: [{ text: prompt }]
        }
      ]
    };
  }

  const url = `${getDashscopeRoot()}${servicePath}`;
  // 2026-06-04：异步任务接口也走同一个 60s dispatcher，
    // 避免创建任务请求被 DNS 冷启动干死。
    const response = (await undiciFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable"
      },
      dispatcher: getDashscopeAgent(),
      body: JSON.stringify({
      model,
      input: inputPayload,
      parameters: {
        size,
        n: 1
      }
    })
  })) as unknown as DomResponse;
  const text = await response.text();
  let data: DashscopeTaskCreateResponse = {};
  try {
    if (text) {
      data = JSON.parse(text) as DashscopeTaskCreateResponse;
    }
  } catch {
    throw new Error(`百炼文生图任务创建返回非JSON: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(data.message ?? data.code ?? `百炼文生图任务创建失败 (${response.status})`);
  }
  return data;
}

  async function queryImageTask(taskId: string) {
    const url = `${getDashscopeRoot()}/api/v1/tasks/${taskId}`;
    // 2026-06-04：任务查询也走同一个 dispatcher，保持 connectTimeout 行为一致。
    const response = (await undiciFetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      dispatcher: getDashscopeAgent()
    })) as unknown as DomResponse;
  const text = await response.text();
  let data: DashscopeTaskQueryResponse = {};
  try {
    if (text) {
      data = JSON.parse(text) as DashscopeTaskQueryResponse;
    }
  } catch {
    throw new Error(`百炼文生图任务查询返回非JSON: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(data.message ?? data.code ?? `百炼文生图任务查询失败 (${response.status})`);
  }
  return data;
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

export async function generateStyledImage(prompt: string, model: string) {
  // 如果是 wanx / wan 等异步模型，直接走 createImageTask
  if (model.startsWith("wan")) {
    return runAsyncImageTask(prompt, model);
  }

  if (model.startsWith("qwen-image") || model.startsWith("qwen_image")) {
    return runSyncMultimodalImageGeneration(prompt, model);
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
    console.log(`[Bailian] /images/generations failed:`, error);
    // 忽略错误，降级到 Task API
  }

  return runAsyncImageTask(prompt, model);
}

  async function runSyncMultimodalImageGeneration(prompt: string, model: string) {
    const url = `${getDashscopeRoot()}/api/v1/services/aigc/multimodal-generation/generation`;
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
        body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ text: prompt }]
            }
          ]
        },
        parameters: {
          size: "1024*1024",
          n: 1
        }
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
    throw new Error(`fetch failed: ${err instanceof Error ? err.message : String(err)}${causeHint}`);
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

async function runAsyncImageTask(prompt: string, model: string) {
  const task = await withRetry(() => createImageTask(prompt, model));
  const directUrl = task.output?.results?.[0]?.url ?? task.output?.result_url;
  if (directUrl) {
    return directUrl;
  }
  const taskId = task.output?.task_id;
  if (!taskId) {
    throw new Error("未获取到文生图任务ID");
  }

  for (let i = 0; i < 20; i += 1) {
    await delay(2000);
    const status = await withRetry(() => queryImageTask(taskId), 2);
    const taskStatus = status.output?.task_status;
    if (taskStatus === "SUCCEEDED") {
      const imageUrl =
        status.output?.results?.[0]?.url ??
        status.output?.result_url ??
        status.output?.choices?.[0]?.message?.content?.[0]?.image;
      if (imageUrl) {
        return imageUrl;
      }
      throw new Error("任务成功但未返回图片URL");
    }
    if (taskStatus === "FAILED" || taskStatus === "CANCELED") {
      throw new Error(status.output?.message ?? status.message ?? "文生图任务执行失败");
    }
  }
  throw new Error("文生图任务超时，请重试");
}
