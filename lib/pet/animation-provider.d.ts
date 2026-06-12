// Single-provider availability for the AI animation feature.
// 2026-06-04 撤回了 MiniMax，现在项目只用 DashScope Wan。
// 这里只导出 Wan 一家。

export type AnimationProviderId = "dashscope_wan";

export type AnimationProviderStatus = {
  available: boolean;
  envKey: string;
  reason: "configured" | "missing_api_key";
};

export type AnimationProviderAvailability = {
  dashscope_wan: AnimationProviderStatus;
};

export function getAnimationProviderAvailability(
  env: Record<string, unknown>
): AnimationProviderAvailability;

declare const _default: {
  ANIMATION_PROVIDER_ID: "dashscope_wan";
  getAnimationProviderAvailability: typeof getAnimationProviderAvailability;
};
export default _default;
