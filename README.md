# Pawnear · 爪伴 — AI 数字桌宠

工作品牌已更新；公开发布仍受[上线验收清单](docs/pawnear-launch-checklist.md)约束。当前不是已上线服务。

上传一张宠物照片，AI 会帮你生成 4 种风格化形象。选定喜欢的风格后，可以一键生成有呼吸感的动态视频，然后召唤到桌面作为电子宠物。所有形象和视频都会自动保存在你的档案库里，下次召唤直接复用，不再重复烧模型费用。

当前是 **1A 本地封闭验收版，不是已验收的公开商用版本**。最新交付、证据与上线阻断项见 [1A 复核记录](docs/phase-1a-audit-2026-09-08.md)。生成任务在 PostgreSQL 中持久化，刷新后可到 `/tasks` 找回结果。额度默认 0，验收脚本不调用付费模型。

**技术栈：** Next.js 15（App Router）+ TypeScript + Tailwind CSS + Electron 桌宠壳 + DashScope Wan 2.6 Flash 视频生成 + RVM 视频抠像

---

## 环境要求

- **Node.js** >=22.19（本批验证使用 24.18.0，见 `.node-version`）
- **npm** 10+
- **Docker Desktop**（运行本地 PostgreSQL；或自行配置 `DATABASE_URL`）
- （可选）**Electron** 桌面环境（用于桌宠壳）

---

## 快速启动

### 1. 安装依赖

```bash
npm ci
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

初始化本地数据库（先启动 Docker Desktop），生成的 `.env.1a.local` 含本机密码与邀请码，请勿提交或分享：

```powershell
npm run service:setup
npm run migrate
```

已有旧档案时，先备份 `data/`，再依次运行 `npm run migrate:legacy`、`npm run migrate:pets`。纯新安装跳过这两步。本仓库现有 17 份旧档案已经导入 PostgreSQL；重复导入不会覆盖数据库中的编辑。

`ASSET_STORAGE=local` 支持私有素材、已有档案与桌宠验收；默认 Wan 2.6 读取私有参考图还需要配置可达的私有 S3 桶。服务端额度只是内测调用预算，不是已接入支付的余额；配置云端存储与实际付费额度后才进行真实生成验收。

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

此命令同时启动网页与 worker。打开 `http://127.0.0.1:3000/login`，用本机邀请码注册，或登录已迁移的账号。检查 `http://127.0.0.1:3000/health` 的数据库和 worker 状态。

---

## 环境变量参考

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `DASHSCOPE_API_KEY` | ✅ | — | 阿里云 DashScope API Key（百炼平台） |
| `BAILIAN_BASE_URL` | — | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 百炼 OpenAI 兼容接口地址 |
| `BAILIAN_VL_MODEL` | — | `qwen3-vl-plus` | 宠物特征提取模型（视觉语言） |
| `BAILIAN_PET_IMAGE_MODEL` | — | `qwen-image-edit-plus-2025-12-15` | 携带原图的宠物风格化编辑模型；旧 `BAILIAN_IMAGE_MODEL` 不控制此流程 |
| `DASHSCOPE_VIDEO_MODEL` | — | `wan2.6-i2v-flash` | 动态视频生成模型 |
| `DASHSCOPE_VIDEO_BASE_URL` | — | 自动从 `BAILIAN_BASE_URL` 推导 | DashScope 视频 API 地址 |
| `FFMPEG_PATH` | — | `bin/ffmpeg.exe` | 自定义 ffmpeg 路径（视频抠像用） |

运行 `npm run models:inspect` 查看实际生效模型（不调用付费 API）。[模型与提示词复核](docs/model-review-2026-09-09.md)包含同模型优化、12 张真实对比图的证据位置、新 Qwen 模型接入方式及微调建议。对比工具默认只预览提示词，显式加 `--run` 才调用模型。

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

统一桌面入口为 `app-shell`。本地验收时，在另一个 PowerShell 窗口运行：

```powershell
npm ci --prefix app-shell
$env:LEMON_CAT_URL = 'http://127.0.0.1:3000'
npm start --prefix app-shell
```

在桌面应用中登录并召唤已保存的透明 WebM，客户端会下载本人素材、校验并缓存，在透明窗口循环播放。下次离线启动恢复最近缓存。浏览器只能预览，不会启动服务器机器上的 Electron。旧 `desktop-pet-shell` 保留用于历史开发工具，不再是新服务的投放入口；静态图/帧序列旧投放 API 返回 410。

---

## 验证命令

```bash
npm run lint
npm run typecheck
npm run build
npm run doctor
npm run check
npm run check:service
# 以下两项要求网页与 worker 正在运行
npm run check:http
npm run check:desktop
```

生产模式本机检查：先停止 dev，运行 `npm run build`，然后分别运行 `npm run start` 与 `npm run worker`。不要让 dev/build 同时改写 `.next`。`check:http` 和 `check:desktop` 只创建隔离的合成素材/测试账号，不会替真实账号增加额度。

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
