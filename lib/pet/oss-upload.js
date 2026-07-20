// 2026-07-15 Step 6.2：阿里云 DashScope OSS 上传封装。
//
// 背景：wan2.6 i2v 异步任务的 input.img_url 字段不接受 data: URL，
// 必须用 oss:// 协议或公网 https URL。本模块把本地图片字节流
// 上传到阿里云 OSS，返回 DashScope 异步任务可以接受的 oss:// URL。
//
// 流程（参考 test-oss-upload.js 验证过的端点）：
//   1. GET /api/v1/uploads?action=getPolicy&model=<model>  拿 OSS 直传 policy
//   2. 用 policy + 图片字节流 POST 到 upload_host
//   3. 拼出 oss://<bucket>/<key> 协议 URL 返回
//
// 失败模式：
//   - policy 端点 401/403 → API key 错
//   - policy 端点 4xx → 模型名不在白名单
//   - OSS 上传 4xx → 签名/策略过期，重新走 1 即可

const { fetch: undiciFetch, FormData, Blob } = require("undici");

const DASHSCOPE_HOST = "https://dashscope.aliyuncs.com";

async function fetchUploadPolicy(apiKey, model) {
  const url = `${DASHSCOPE_HOST}/api/v1/uploads?action=getPolicy&model=${encodeURIComponent(model)}`;
  const res = await undiciFetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OSS policy 获取失败 (${res.status}): ${text.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OSS policy 返回非 JSON: ${text.slice(0, 200)}`);
  }
  const d = json.data;
  if (!d || !d.upload_host || !d.upload_dir || !d.policy || !d.signature || !d.oss_access_key_id) {
    throw new Error(`OSS policy 字段缺失: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return d;
}

async function uploadBytesToOss(uploadHost, policy, imageBytes, contentType, key) {
  const fd = new FormData();
  fd.append("OSSAccessKeyId", policy.oss_access_key_id);
  fd.append("Signature", policy.signature);
  fd.append("policy", policy.policy);
  fd.append("key", key);
  if (policy.x_oss_object_acl) {
    fd.append("x-oss-object-acl", policy.x_oss_object_acl);
  }
  if (policy.x_oss_forbid_overwrite) {
    fd.append("x-oss-forbid-overwrite", policy.x_oss_forbid_overwrite);
  }
  fd.append("success_action_status", "200");
  // file 字段必须最后 append
  fd.append("file", new Blob([imageBytes], { type: contentType }), key.split("/").pop());

  const res = await undiciFetch(uploadHost, { method: "POST", body: fd });
  if (res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`OSS 上传失败 (${res.status}): ${text.slice(0, 200)}`);
  }
}

function buildOssUrl(uploadHost, key) {
  // 2026-07-15 Step 6.2：i2v 任务最稳的格式是 https:// 公网 URL。
  // 之前的 oss://bucket/key 协议 URL 在某些 i2v 异步任务里会被拒绝。
  // uploadHost 形如 "https://happy-horse-test.oss-cn-beijing.aliyuncs.com"
  // 直接拼成 https://<uploadHost>/<key> 就是公网可访问的 URL。
  const host = uploadHost.replace(/\/$/, "");
  return `${host}/${key}`;
}

function pickExtension(contentType) {
  const m = /image\/(\w+)/i.exec(contentType || "");
  if (!m) return "png";
  const ext = m[1].toLowerCase();
  if (ext === "jpeg") return "jpg";
  return ext;
}

async function uploadImageToOss(apiKey, imageBytes, contentType, model) {
  if (!apiKey) {
    throw new Error("uploadImageToOss: 缺少 DASHSCOPE_API_KEY");
  }
  if (!Buffer.isBuffer(imageBytes) || imageBytes.length === 0) {
    throw new Error("uploadImageToOss: imageBytes 必须是非空 Buffer");
  }
  const ext = pickExtension(contentType);
  const policy = await fetchUploadPolicy(apiKey, model);
  const fileName = `lemon-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const key = `${policy.upload_dir}/${fileName}`;
  await uploadBytesToOss(policy.upload_host, policy, imageBytes, contentType || "image/png", key);
  return buildOssUrl(policy.upload_host, key);
}

module.exports = {
  uploadImageToOss,
  // 暴露内部函数方便测试
  fetchUploadPolicy,
  buildOssUrl,
  pickExtension
};
