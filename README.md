# 🍋 柠檬树苗 — AI 数字桌宠

上传一张宠物照片，AI 会帮你生成 4 种风格化形象。选定喜欢的风格后，可以一键生成有呼吸感的动态视频，然后召唤到桌面作为电子宠物。所有形象和视频都会自动保存在你的档案库里，下次召唤直接复用，不再重复烧模型费用。

**技术栈：** Next.js 15（App Router）+ TypeScript + Tailwind CSS + Electron 桌宠壳 + DashScope Wan 2.6 Flash 视频生成 + RVM 视频抠像

---

## 环境要求

- **Node.js** 20+
- **npm** 10+
- （可选）**Electron** 桌面环境（用于桌宠壳）

---

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

```bash
# Windows
copy .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 DashScope API Key：

```env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

其他变量都有默认值，一般不需要改。

### 3. 准备模型文件（抠像用）

在项目根目录创建 `models/` 文件夹，放入以下两个 ONNX 模型：

```
models/
├── rmbg/
│   └── rmbg-1.4.onnx
└── rvm/
    └── rvm_mobilenetv3_fp32.onnx
```

> 模型下载地址见下方「模型文件」一节。

### 4. 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:3000`，上传宠物照片，开始玩 🎉

---

## 环境变量参考

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `DASHSCOPE_API_KEY` | ✅ | — | 阿里云 DashScope API Key（百炼平台） |
| `BAILIAN_BASE_URL` | — | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容接口地址 |
| `BAILIAN_VL_MODEL` | — | `qwen3-vl-plus` | 宠物特征提取模型（视觉语言） |
| `BAILIAN_IMAGE_MODEL` | — | `wan2.6-t2i` | 风格化形象生成模型 |
| `DASHSCOPE_VIDEO_MODEL` | — | `wan2.6-i2v-flash` | 动态视频生成模型 |
| `DASHSCOPE_VIDEO_BASE_URL` | — | 自动从 `BAILIAN_BASE_URL` 推导 | DashScope 视频 API 地址 |
| `FFMPEG_PATH` | — | `bin/ffmpeg.exe` | 自定义 ffmpeg 路径（视频抠像用） |

---

## 模型文件

抠像需要两个 ONNX 模型，请下载后放在对应位置：

```
models/
├── rmbg/
│   └── rmbg-1.4.onnx          # 背景移除模型
└── rvm/
    └── rvm_mobilenetv3_fp32.onnx  # 视频逐帧抠像模型
```

> 可从 HuggingFace 等模型平台搜索下载，建议使用 `briaai/RMBG-1.4` 和 `PeterL1n/RobustVideoMatting`。

---

## 桌宠壳（Electron）

如果想把生成的动态宠物放到桌面，需要单独启动 Electron 桌宠壳：

```bash
cd desktop-pet-shell
npm install
npm run dev:pet-shell
```

桌宠壳会监听项目根目录的 `desktop-pet-shell/config.json`，当你在 Web 页面点击「召唤到桌面」时，视频文件会被自动写入并加载。

---

## 验证命令

```bash
npm run lint
npm run typecheck
npm run build
```

---

## 功能链路

```
上传照片 → AI 提取特征 → 生成 4 种风格形象
    ↓
选择形象 + 完善档案（名字/性格）
    ↓
生成动态视频（Wan 2.6 Flash I2V + RVM 抠像）
    ↓
保存到档案库 → 召唤到桌面（优先复用已缓存的视频）
```

所有生成的视频都会被持久化保存，同一个形象下次召唤时不会再重复调用 API。
