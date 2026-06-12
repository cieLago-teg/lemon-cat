import { NextResponse } from "next/server";
import { extractPetFeatures } from "@/lib/bailian";
import { resolveFeatureSystemPrompt } from "@/lib/prompts";

type ExtractRequest = {
  imageBase64?: string;
  mimeType?: string;
  featureSystemPrompt?: string;
};

const featureModel = process.env.BAILIAN_VL_MODEL ?? "qwen3-vl-plus";

export async function POST(request: Request) {
  try {
    console.log(`[ExtractRoute] featureModel=${featureModel}`);
    const body = (await request.json()) as ExtractRequest;
    if (!body.imageBase64 || !body.mimeType) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }
    const imageBase64WithMime = `data:${body.mimeType};base64,${body.imageBase64}`;
    const featureSystemPrompt = resolveFeatureSystemPrompt(body.featureSystemPrompt);
    
    const petFeatures = await extractPetFeatures(imageBase64WithMime, featureModel, featureSystemPrompt);
    
    // 我们将特征字符串拆分为标签数组返回给前端
    const tags = petFeatures
      .split(/[,，、。.\n]/)
      .map((t) => t.trim())
      .filter(Boolean);

    return NextResponse.json({
      petFeatures,
      tags
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务异常";
    return NextResponse.json({ error: `${message} (feature=${featureModel})` }, { status: 500 });
  }
}
