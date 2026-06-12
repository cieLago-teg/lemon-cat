declare module "@/lib/pet/animation-prompt.js" {
  export type StyleKey = "pixel" | "sticker" | "realistic";
  export interface StyleRule {
    matchers: string[];
    extra: string[];
  }
  export const STYLE_RULES: Record<StyleKey, StyleRule>;
  export function detectStyleKey(styleHint: string | null | undefined): StyleKey | null;
  export function buildDefaultPrompt(styleHint: string | null | undefined): string;
  export function buildIdlePrompt(input: string | null | undefined, styleHint?: string | null | undefined): string;
}
