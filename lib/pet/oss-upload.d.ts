// 2026-07-15：lib/pet/oss-upload.js 的 TypeScript 声明文件。
// lib/pet/*.js 是 CommonJS，但被 ESM .ts 文件 import 时需要类型声明。

export function uploadImageToOss(
  apiKey: string,
  imageBytes: Buffer,
  contentType: string,
  model: string
): Promise<string>;

export function fetchUploadPolicy(
  apiKey: string,
  model: string
): Promise<{
  upload_host: string;
  upload_dir: string;
  policy: string;
  signature: string;
  oss_access_key_id: string;
  x_oss_object_acl?: string;
  x_oss_forbid_overwrite?: string;
}>;

export function buildOssUrl(uploadHost: string, key: string): string;
export function pickExtension(contentType: string): string;
