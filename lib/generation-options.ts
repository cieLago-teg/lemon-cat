import { STYLE_PROMPTS } from './prompts';

export const MAX_CANDIDATES = 3;
export function generationOptions(input: { styles?: unknown; candidatesPerStyle?: unknown; stylePrompts?: unknown }) {
  const count = input.candidatesPerStyle ?? 1;
  if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > MAX_CANDIDATES) throw new Error('每种画风请选择 1 至 3 张候选');
  // 兼容旧页面传来的风格名，但模板统一由服务端确定。
  const legacy = Array.isArray(input.stylePrompts) ? input.stylePrompts.map((s) => s?.style) : undefined;
  const names = input.styles ?? legacy ?? STYLE_PROMPTS.map((s) => s.style);
  if (!Array.isArray(names) || !names.length || names.length > 3 || new Set(names).size !== names.length || names.some((s) => !STYLE_PROMPTS.some((p) => p.style === s))) throw new Error('请选择有效且不重复的画风');
  const styles = STYLE_PROMPTS.filter((s) => names.includes(s.style));
  return { styles, candidatesPerStyle: Number(count), total: styles.length * Number(count) };
}

export function validateFeatureInput(input: { aiTags?: unknown; customFeatures?: unknown; petVibe?: unknown }) {
  if (!Array.isArray(input.aiTags) || input.aiTags.length > 20 || input.aiTags.some((t) => typeof t !== 'string' || t.length > 40) || input.aiTags.join('，').length > 240) throw new Error('请把外观标签精简到 20 条、共 240 字以内');
  if (input.customFeatures !== undefined && (typeof input.customFeatures !== 'string' || input.customFeatures.length > 120)) throw new Error('特别特征请控制在 120 字以内');
  if (input.petVibe !== undefined && (typeof input.petVibe !== 'string' || input.petVibe.length > 40)) throw new Error('神态描述请控制在 40 字以内');
}
