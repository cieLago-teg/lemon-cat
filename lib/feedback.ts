export const FAILURE_LABELS = {
  identity: '不像我的宠物', style: '画风不对', anatomy: '多头 / 多只 / 肢体异常', markings: '毛色花纹不对', crop: '耳爪尾被裁切', background: '背景或白边问题', detail: '模糊 / 细节不好'
} as const;
export const RATING_LABELS = { identity: '像不像它', style: '画风满意度', anatomy: '身体完整度', desktop: '桌宠形象满意度' } as const;
export function validateFeedback(value: unknown) {
  const v = value as { ratings?: Record<string, number>; failures?: string[]; liked?: boolean };
  const ratings = v?.ratings || {};
  if (!v || typeof v !== 'object' || Object.keys(RATING_LABELS).some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5) || !Array.isArray(v.failures) || v.failures.length > 7 || v.failures.some((key) => !Object.hasOwn(FAILURE_LABELS, key)) || typeof v.liked !== 'boolean') throw new Error('请完成四项 1 至 5 分评分');
  return { ratings: Object.fromEntries(Object.keys(RATING_LABELS).map((key) => [key, v.ratings![key]])), failures: [...new Set(v.failures)], liked: v.liked };
}
