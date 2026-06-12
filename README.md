# 数字宠物克隆 Demo

基于 Next.js App Router 构建的宠物图片克隆演示项目，完整链路仅接入阿里云百炼兼容 OpenAI 协议接口。

## 环境要求

- Node.js 20+
- npm 10+

## 快速启动

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（从示例复制）

```bash
copy .env.example .env.local
```

3. 编辑 `.env.local`

```env
DASHSCOPE_API_KEY=your_dashscope_api_key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_VL_MODEL=qwen3-vl-plus
BAILIAN_IMAGE_MODEL=qwen-image-2.0
```

4. 启动开发服务

```bash
npm run dev
```

## 阿里云百炼接入说明

1. 开通服务与获取密钥
   - 登录阿里云百炼控制台，开通模型服务并创建 API Key
   - 将 API Key 写入本地 `.env.local` 的 `DASHSCOPE_API_KEY`
2. 配置兼容 OpenAI 协议的请求基地址
   - `BAILIAN_BASE_URL` 默认使用 `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 鉴权方式为 `Authorization: Bearer <DASHSCOPE_API_KEY>`
3. 两阶段调用路径
   - 阶段一：`POST /chat/completions`，模型默认 `qwen3-vl-plus`
   - 阶段二：`POST /images/generations`，模型默认 `qwen-image-2.0`
   - 阶段二使用 `Promise.all` 并发 4 路风格生成
4. 用户原文 Prompt 覆盖方式
   - 支持在 `/api/clone` 请求体中传入 `featureSystemPrompt` 作为系统 Prompt 原文
   - 支持传入 `stylePrompts`（长度需为 4）覆盖 4 种风格模板
   - 每条风格模板会对 `[宠物特征]` 占位符执行拼接；若未包含占位符，则自动在模板末尾追加特征文本

### `/api/clone` 请求体示例（覆盖系统 Prompt + 4 风格原文）

```json
{
  "imageBase64": "<base64数据>",
  "mimeType": "image/jpeg",
  "featureSystemPrompt": "你是一个世界级的宠物特征鉴定专家。请精准提取图中宠物的外貌特征（品种、体型胖瘦、主色调、毛发质感、特定斑纹位置、眼睛颜色、标志性神态）。必须输出纯中文描述，精炼且画面感强，不超过 50 个字。例如：一只微胖的橘猫，毛发蓬松，白手套，右耳有一个缺口，眼神慵懒，绿眼睛。",
  "stylePrompts": [
    { "style": "盲盒公仔风 (Pop Mart Style)", "template": "3D潮玩盲盒风格，[宠物特征]。泡泡玛特质感，光滑的塑料与微磨砂黏土材质，边缘圆润，极其可爱的Q版大头比例。宠物站在一个马卡龙纯色圆盘底座上。影棚级柔和打光，辛烷值渲染(Octane Render)，纯色干净背景，8k分辨率，细节完美。" },
    { "style": "治愈羊毛毡 (Needle Felting)", "template": "微距摄影，手工羊毛毡玩偶风格，[宠物特征]。表面布满细密毛糙的羊毛纤维质感，边缘有自然的毛流感，带有手工制作的钝感与粗糙感。放置在干净的浅色木质桌面上，暖色调温馨光线，背景具有浅景深虚化效果，治愈系氛围，极其逼真的材质细节。" },
    { "style": "绘本涂鸦风 (Crayon Doodle)", "template": "极简治愈系儿童绘本插画，[宠物特征]。使用粗糙的蜡笔涂鸦线条，类似Jellycat的丑萌神态，平涂上色，边缘不规则。2D平面风格，夸张且极其生动的表情，白色纸张背景，带有轻微的纸张纹理，天真烂漫的艺术风格。" },
    { "style": "复古像素风 (Retro Pixel Art)", "template": "16-bit复古像素艺术风格，[宠物特征]。类似《星露谷物语》和GBA掌机游戏的经典画风。扁平色块，清晰的黑色边缘线，造型极简可爱。纯色鲜艳明亮的背景，完美的像素网格对齐，复古游戏氛围，无噪点。" }
  ]
}
```

## 验证命令

```bash
npm run lint
npm run typecheck
npm run build
```
