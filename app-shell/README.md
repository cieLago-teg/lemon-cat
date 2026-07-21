# 柠檬猫桌面应用 (app-shell)

2026-07-20：把 Next.js 网页版包装成 Electron 桌面应用。

## 这是什么

- 一个 Electron 应用，启动后打开一个**桌面窗口**，加载 [outstanding-purpose-production-8d0c.up.railway.app](https://outstanding-purpose-production-8d0c.up.railway.app)（Railway 部署的 Next.js 网站）
- 用户体验：双击 `.exe` / `.dmg` 安装 → 双击桌面图标 → 弹出柠檬猫应用窗口
- 跟"透明 Live2D 桌宠壳"（`../desktop-pet-shell/`）**不一样**：
  - `desktop-pet-shell/` = 透明背景 + Live2D 实时渲染 + 鼠标穿透 + 全局快捷键
  - `app-shell/` = 套壳浏览器，**展示完整网页版**（档案库 + 召唤 + 浮动桌宠 + 全部页面）
- 两者互补：网页版做"展厅"，Live2D 桌宠做"陪伴"。

## 工作原理

- Electron 主进程（`main.js`）启动一个 BrowserWindow
- 用 `loadURL(APP_URL)` 直接加载线上 URL（不需要把 Next.js 打包进来）
- 单例锁：第二次启动会聚焦到现有窗口
- 外部链接（GitHub、阿里云等）自动用系统浏览器打开
- 不签名（开发/演示用）

## 安装包获取（推荐用 GitHub Actions）

**不要在本地跑 npm install**——TRAE IDE 的 sandbox 限制 + 教育网到 GitHub releases 不通。

直接用 GitHub Actions 云端构建：

1. 打开 GitHub 仓库 → Actions 标签
2. 选 "柠檬猫桌面应用构建" workflow
3. 点 "Run workflow" → 选平台（默认两个都跑）
4. 等 5-10 分钟
5. 跑完后在 workflow run 页面底部下载：
   - `柠檬猫-Windows-Setup` → 里面的 `.exe` 双击安装
   - `柠檬猫-macOS-DMG` → 里面的 `.dmg` 双击挂载 → 拖到 Applications

> 自动触发：每次 `git push` 到 main 分支，workflow 会自动跑。

## 本地开发（如果 sandbox 允许）

```bash
cd app-shell
npm install
npm start              # 启动应用，加载线上 URL
npm run build:app:win  # 打 Windows .exe
npm run build:app:mac  # 打 macOS .dmg
```

> ⚠️ 本地 build 需要能下载 electron 二进制（github-releases 或 npmmirror），sandbox 模式下可能失败。

## 自定义

- **换部署 URL**：编辑 `main.js` 第 8 行的 `APP_URL`，或运行时设环境变量 `LEMON_CAT_URL`
- **改窗口大小**：编辑 `main.js` 第 19-20 行的 `width` / `height`
- **改应用名 / 图标**：编辑 `package.json` 的 `build.productName`，把图标 PNG/ICO 放到 `build/` 目录
- **启用代码签名**（要花 $100-300 买证书）：编辑 `package.json` 的 `mac.identity` 和 `win.signtoolOptions`

## 文件结构

```
app-shell/
├── main.js            # Electron 主进程（启动窗口 + 加载 URL）
├── preload.js         # 渲染层桥接（预留扩展点）
├── package.json       # 依赖 + electron-builder 配置
├── .gitignore         # 忽略 node_modules / dist
├── README.md          # 本文件
└── build/             # 图标资源（待补充：icon.ico / icon.icns / icon.png）
```
