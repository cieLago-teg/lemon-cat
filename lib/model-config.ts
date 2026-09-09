// 官方协议核对日期 2026-09-09；模型可调用权限仍取决于百炼地域和账号。
export const DEFAULT_MODELS = {
  vision: 'qwen3-vl-plus',
  image: 'qwen-image-edit-plus-2025-12-15',
  video: 'wan2.6-i2v-flash'
} as const;

export const IMAGE_MODELS = [
  'qwen-image-edit-plus', 'qwen-image-edit-plus-2025-10-30', 'qwen-image-edit-plus-2025-12-15',
  'qwen-image-edit-max', 'qwen-image-edit-max-2026-01-16',
  'qwen-image-2.0', 'qwen-image-2.0-2026-03-03',
  'qwen-image-2.0-pro', 'qwen-image-2.0-pro-2026-03-03', 'qwen-image-2.0-pro-2026-04-22', 'qwen-image-2.0-pro-2026-06-22',
  'qwen-image-3.0', 'qwen-image-3.0-pro'
] as const;

export function resolveModels(env: Record<string, string | undefined> = process.env) {
  return {
    vision: env.BAILIAN_VL_MODEL?.trim() || DEFAULT_MODELS.vision,
    image: env.BAILIAN_PET_IMAGE_MODEL?.trim() || DEFAULT_MODELS.image,
    video: env.DASHSCOPE_VIDEO_MODEL?.trim() || DEFAULT_MODELS.video
  };
}

export function buildVisionRequest(image: string, model: string, systemPrompt: string) {
  // 纯外观提取用非思考模式，避免新系列默认长推理耗时；未知模型保留自身默认参数。
  const hybrid = /^qwen3-vl-(plus|flash)(-|$)|^qwen3\.[567]-(plus|flash)(-|$)|^qwen3\.8-flash$/.test(model);
  return {
    model, temperature: 0.2, max_tokens: 768,
    ...(hybrid ? { enable_thinking: false } : {}),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: '记录这只宠物实际可见的外观特征，供主人逐条编辑。' }
      ] }
    ]
  };
}

export function normalizeFeatureTags(content: string) {
  const clean = content.trim().replace(/^```(?:json|text)?\s*/i, '').replace(/\s*```$/, '').replace(/^(?:输出|特征)[：:]/, '');
  const tags = [...new Set(clean.split(/[,，、。\n;；]+/).map((tag) => tag.trim()).filter(Boolean))];
  if (!tags.length) throw new Error('特征提取结果为空，请重新选择原图');
  if (tags.length > 30) throw new Error('特征提取返回过多标签，请缩短提取要求');
  return tags;
}

export function buildPetImageRequest(prompt: string, source: string, model: string, seed?: number) {
  if (!(IMAGE_MODELS as readonly string[]).includes(model)) throw new Error(`未支持的宠物图像编辑模型：${model}，请检查 BAILIAN_PET_IMAGE_MODEL`);
  if (!source) throw new Error('宠物图像编辑必须携带原图');
  if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 2147483647)) throw new Error('图像 seed 必须在 0 至 2147483647 之间');
  return {
    model,
    input: { messages: [{ role: 'user', content: [{ image: source }, { text: prompt }] }] },
    parameters: {
      size: '1024*1024', n: 1, prompt_extend: false, watermark: false,
      negative_prompt: '多只宠物，多视图拼图，文字标注，人类，新增肢体，身体融合，画面裁切',
      ...(seed === undefined ? {} : { seed })
    }
  };
}

export function buildPetVideoRequest(prompt: string, imageUrl: string, model: string) {
  const parameters = { resolution: '720P', duration: 5, watermark: false, prompt_extend: false };
  if (/^wan2\.7-i2v(?:-\d{4}-\d{2}-\d{2})?$/.test(model)) {
    // 新协议用 media，首尾传同一张选择图；这约束端点，不保证中间运动或拼接完全无缝。
    return { model, input: { prompt, media: [{ type: 'first_frame', url: imageUrl }, { type: 'last_frame', url: imageUrl }] }, parameters };
  }
  return { model, input: { prompt, img_url: imageUrl }, parameters: { ...parameters, ...(model === 'wan2.6-i2v-flash' ? { audio: false } : {}) } };
}
