import { NextResponse } from "next/server";
import { generateStyledImage } from "@/lib/bailian";
import {
  CHROMA_KEY_BG_CONSTRAINT,
  injectPetFeatures,
  NON_ANTHRO_CONSTRAINT,
  resolveStylePrompts,
  TAIL_VISIBLE_CONSTRAINT,
  WHITE_BG_PANEL_CONSTRAINT
} from "@/lib/prompts";

type GenerateRequest = {
  petName: string;
  petVibe: string;
  aiTags: string[];
  customFeatures: string;
  bgMode?: "white" | "green" | "none";
  stylePrompts?: Array<{
    style?: string;
    template?: string;
  }>;
};

const imageModel = process.env.BAILIAN_IMAGE_MODEL ?? "wan2.6-t2i";

export async function POST(request: Request) {
  try {
    console.log(`[GenerateRoute] imageModel=${imageModel}`);
    const body = (await request.json()) as GenerateRequest;
    
    // 组装最终特征字符串
    // 格式: "{petVibe} 的氛围与神态, {aiTags}, 补充特征: {customFeatures}"
    const vibePart = body.petVibe ? `${body.petVibe}的氛围与神态` : "";
    const tagsPart = (body.aiTags || []).join("，");
    const customPart = body.customFeatures ? `补充特征：${body.customFeatures}` : "";
    
    const combinedFeatures = [vibePart, tagsPart, customPart]
      .filter(Boolean)
      .join("，");

    const stylePrompts = resolveStylePrompts(body.stylePrompts);
    const bgMode = body.bgMode ?? "white";
    
    // 串行生成防止 429
    const results = [];
    for (const { style, template } of stylePrompts) {
      const bgConstraint =
        bgMode === "white"
          ? `\n${WHITE_BG_PANEL_CONSTRAINT}`
          : bgMode === "green"
            ? `\n${CHROMA_KEY_BG_CONSTRAINT}`
            : "";
      const prompt = `${injectPetFeatures(template, combinedFeatures)}\n${NON_ANTHRO_CONSTRAINT}\n${TAIL_VISIBLE_CONSTRAINT}${bgConstraint}`;
      const imageUrl = await generateStyledImage(prompt, imageModel);
      results.push({ style, imageUrl, prompt });
    }

    return NextResponse.json({
      results
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务异常";
    return NextResponse.json({ error: `${message} (image=${imageModel})` }, { status: 500 });
  }
}
