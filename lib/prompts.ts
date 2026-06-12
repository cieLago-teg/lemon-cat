export const DEFAULT_FEATURE_SYSTEM_PROMPT = `你是一个数字孪生宠物的生物特征提取专家。你的唯一任务是精准提取图中宠物的本体外貌特征。
【提取维度】：
1. 品种与基本形态（如：橘猫、金毛、微胖、短腿）
2. 主色调与毛发质感（如：橘白相间、纯黑、毛发蓬松、短毛）
3. 标志性斑纹与细节（如：四蹄踏雪、额头M纹、右耳缺口）
4. 眼睛颜色与神态（如：绿眼睛、异瞳、眼神慵懒、吐舌头）

【绝对禁止】：
禁止描述任何背景、环境、家具、人类、光影或遮挡物！不要使用任何完整的句子，只输出结构化的特征短语。

【输出格式】：
必须且只能输出纯中文特征短语，用逗号分隔，绝对不要输出任何其他多余的解释性文字！

【Few-Shot 示例】：
输入：一张躺在蓝色沙发上的胖橘猫照片，闭着一只眼睛，白爪子。
输出：微胖橘猫, 橘白相间, 短毛, 四蹄踏雪, 闭单眼, 慵懒神态

输入：一只在草地上的边牧，吐着舌头，毛发很长，黑白相间。
输出：边境牧羊犬, 黑白相间, 长毛蓬松, 吐舌头, 眼神活泼, 尖耳朵

请严格根据以上规则和示例，直接输出当前图片的特征短语：`;

const PET_FEATURES_PLACEHOLDER = "[宠物特征]";

export const NON_ANTHRO_CONSTRAINT =
  "必须保持纯粹动物解剖学结构与自然体态：仅允许四脚着地、自然卧姿或自然坐姿。绝对禁止拟人化、绝对禁止双腿直立行走。严禁穿戴任何人类衣物或饰品（除非用户明确要求）。";

export const TAIL_VISIBLE_CONSTRAINT =
  "尾巴必须可见：无论原图是否露出尾巴，最终形象中尾巴至少露出一部分或尾巴尖，不得完全缺失或被裁切。";

export const CHROMA_KEY_BG_CONSTRAINT =
  "背景必须为单一纯色绿幕（高饱和纯绿色，接近抠像绿幕），画面中除宠物主体外不允许出现任何其他物体/阴影/底座/纹理/渐变/光晕；宠物主体边缘必须清晰干净，禁止背景色溢出到主体边缘，方便后续一键抠图得到透明背景。";

export const WHITE_BG_PANEL_CONSTRAINT =
  "背景必须为纯白色背景面板（纯白 #FFFFFF），画面中除宠物主体外不允许出现任何其他物体/阴影/底座/地面/投影/纹理/渐变/光晕/噪点；背景必须完全均匀干净且四周留白明显，便于后续算法抠图得到透明背景。";

export type StylePrompt = {
  style: string;
  template: string;
};

export const STYLE_PROMPTS: StylePrompt[] = [
  {
    style: "简约可爱水墨风",
    template:
      "极简治愈的新中式水墨简笔IP插画，Q版比例，大头小身，神态俏皮不严肃。全身构图，[宠物特征]。只用少量毛笔线条勾勒外轮廓（2~6笔为宜），线条干净利落，不画真实毛发纹理；仅用极少淡彩点缀（1~2处），几乎无明暗层次与体积塑造。【风格强约束：必须极简、可爱、轻盈、符号化；绝对禁止写实动物肖像、严肃工笔感、复杂笔触堆叠、真实光影与细节刻画】"
  },
  {
    style: "和纸拼贴绘本风",
    template:
      "治愈系和纸拼贴绘本插画，Q版比例，全身构图，[宠物特征]。拼贴纸片只用于“宠物本体”，不得出现与主体无关的背景纸片、底座纸片或装饰纸片。由柔和的纸片色块拼贴成简化宠物轮廓，必须是硬边色块分层拼贴，边缘有轻微手工剪纸感。为避免过于平面：纸片之间必须有明确遮挡关系与层次（前后叠放），每层纸片边缘带极轻微投影（非常淡、非常小范围），可有轻微翘边感来体现纸张厚度，但整体仍保持2D绘本风，细节很少、层次清楚。低饱和马卡龙配色。【风格强约束：必须是纸片拼贴绘本，只允许硬边纸片色块、剪纸边缘与极轻微层叠投影；绝对禁止任何与主体无关的背景拼贴纸片/道具/垫纸；绝对禁止水墨/水彩笔触、晕染、飞白、泼墨、墨点、宣纸肌理、毛笔线条；绝对禁止贴纸粗描边与白色贴纸外框；绝对禁止像素网格、点阵抖动(dithering)、像素颗粒；绝对禁止写实骨骼、真实毛发、复杂光影或强三维体积感】"
  },
  {
    style: "粗描边贴纸风",
    template:
      "粗描边可爱贴纸插画，Q版比例大头小身，全身构图，[宠物特征]。纯色扁平上色，治愈系马卡龙配色，几乎无阴影，线条干净且有弹性。2D平面风格，非常适合做桌面宠物精灵帧。【风格强约束：严格限制在二维平面内，必须是扁平色块和明显的外轮廓描边，绝对不要三维立体感或真实光影】"
  },
  {
    style: "复古像素游戏风",
    template:
      "纯平面2D的复古低密度像素宠物精灵风，强制 16x16 sprite 级别（再放大显示，像素块要非常大、非常清晰），全身构图，[宠物特征]。大头小身，轮廓极简清晰，有限调色板（4色或最多8色），最多 1 层阴影 + 1 层高光；不做抖动（dithering）、不做渐变、不要纹理，不刻画真实毛发细节。必须是最近邻像素放大效果（无抗锯齿、无平滑边缘），像素网格清楚可见，整体更复古、更卡通、更适合做走路/眨眼等逐帧动画。【风格强约束：必须低密度、低细节、纯2D平面sprite像素画；绝对禁止高密度像素、复杂阴影、写实纹理、平滑插画边缘、3D体积与透视】"
  }
];

function isValidStylePrompt(input: unknown): input is StylePrompt {
  if (!input || typeof input !== "object") {
    return false;
  }
  const style = Reflect.get(input, "style");
  const template = Reflect.get(input, "template");
  return typeof style === "string" && style.trim().length > 0 && typeof template === "string" && template.trim().length > 0;
}

export function resolveFeatureSystemPrompt(systemPrompt?: string) {
  const prompt = systemPrompt?.trim();
  return prompt || DEFAULT_FEATURE_SYSTEM_PROMPT;
}

export function resolveStylePrompts(stylePrompts?: unknown) {
  if (!Array.isArray(stylePrompts)) {
    return STYLE_PROMPTS;
  }
  const normalized = stylePrompts
    .filter(isValidStylePrompt)
    .slice(0, 4)
    .map((item) => ({ style: item.style.trim(), template: item.template.trim() }));
  if (normalized.length === 0) {
    return STYLE_PROMPTS;
  }
  return normalized;
}

export function injectPetFeatures(template: string, petFeatures: string) {
  const normalizedTemplate = template.trim();
  const normalizedFeatures = petFeatures.trim();
  if (normalizedTemplate.includes(PET_FEATURES_PLACEHOLDER)) {
    return normalizedTemplate.split(PET_FEATURES_PLACEHOLDER).join(normalizedFeatures);
  }
  return `${normalizedTemplate}\n${normalizedFeatures}`;
}
