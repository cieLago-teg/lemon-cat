# Live2D 模型解剖教学 Demo

> 独立于柠檬猫业务系统之外的教学页，让 cieLago 直观理解 Live2D 模型长什么样、能改什么、怎么改。

---

## 🎯 这个 Demo 在做什么

用一个真实的人物 Live2D 模型（Live2D 官方 **Natori**），从 6 个维度展示 Live2D 的"可改之处"：

| # | 维度 | 看到什么 |
|---|---|---|
| ① | **5 个核心表情滑块** | 拖动 → 眼睛、嘴巴、头、身体立刻变化 |
| ② | **全部 cdi3 参数**（折叠区） | 展开能看到 90+ 个参数（眼/嘴/眉/头/身/臂/发） |
| ③ | **贴图替换** | 1 张整体 PNG 贴图，可上传自定义图覆盖 |
| ④ | **8 个动效** | Idle ×3 + TapBody ×5，点一下播放 |
| ⑤ | **11 个表情** | Normal / Angry / Smile / Sad / Blushing / Surprised / exp_01–05 |
| ⑥ | **7 个身体部位热点** | 👀👄🤨🗣💪💅💇 → 画布高亮 + 参数面板高亮 |

---

## 🚀 打开方式

启动 dev server：

```bash
npm run dev
```

浏览器打开（**必须带 `index.html` 后缀**，Next.js 不会自动 serve 目录）：

```
http://localhost:3000/live2d-anatomy-demo/index.html
```

> 也可以从 **柠檬猫主页 → 任一宠物详情页 → 「🧬 Live2D 模型解剖教学」入口**点击，会新窗口打开。

---

## 📁 文件结构

```
public/live2d-anatomy-demo/
├── index.html       # 教学主页（米黄色解剖图风格 UI）
├── app.js           # PIXI.js + pixi-live2d-display 加载逻辑
├── style.css        # 全部样式（米黄色 paper 主题）
└── README.md        # 本文档

public/models/pet-human-natori/   # Natori 完整运行时（镜像，供 dev server 静态服务）
├── Natori.model3.json
├── Natori.moc3
├── Natori.cdi3.json
├── Natori.physics3.json
├── Natori.pose3.json
├── Natori.2048/
│   └── texture_00.png
├── exp/             # 11 个 .exp3.json 表情
└── motions/         # 8 个 .motion3.json 动效

desktop-pet-shell/models/pet-human-natori/   # 主仓模型副本（供 Electron 桌宠壳加载）
├── （同上结构）
└── LICENSE.md       # Free Material License 标注
```

---

## 🔬 热点 → 参数映射表

点击右下方 6 个"身体部位"按钮 → 画布上高亮该部位 → 右侧参数面板同步高亮对应参数。

| 部位 | 高亮的参数 | 作用 |
|---|---|---|
| 👀 眼睛 | ParamEyeLOpen / ParamEyeROpen / ParamEyeBallX / ParamEyeBallY | 眨眼 + 眼球方向 |
| 👄 嘴巴 | ParamMouthOpenY / ParamMouthForm / ParamMouthSmile / ParamMouthPucker | 张嘴 + 嘴形 |
| 🤨 眉毛 | ParamBrowLY / ParamBrowRY / ParamBrowLX / ParamBrowRX / ParamBrowLAngle / ParamBrowRAngle | 挑眉 + 皱眉 |
| 🗣 头部 | ParamAngleX / ParamAngleY / ParamAngleZ / ParamCheek | 头转向 + 红脸 |
| 💪 身体 | ParamBodyAngleX / ParamBodyAngleY / ParamBodyAngleZ / ParamBreath | 身体转向 + 呼吸 |
| 💅 手臂 | ParamArmLA / ParamArmLB / ParamArmRA / ParamArmRB / ParamHandL / ParamHandR | 手臂摆动 |
| 💇 头发/裙摆 | ParamHairFront / ParamHairSide / ParamHairBack / ParamSkirt | 头发/裙摆飘动 |

---

## 💡 为什么是 Natori？

项目里既有的 `desktop-pet-shell/models/pet-cat/`（shizuku 改名）**只有人脸参数**，没有身体/手臂控制，做不到身体语言。

Natori 是 Live2D 官方在 [CubismWebSamples](https://github.com/Live2D/CubismWebSamples) 仓库里专门为"**Adding Body Movement + Adding Arm Movement**"教程准备的全功能半身模型：

- ✅ 90+ 参数，覆盖眼睛/嘴巴/眉毛/头/身体/手臂/头发/裙摆
- ✅ 11 个表情预设（vs shizuku 只有 Normal/Smile）
- ✅ 8 个动效（Idle 循环 + TapBody 互动）
- ✅ Free Material License，教学专用
- ✅ 官方文档把它当成"标准人物模型"演示

> **教学目的** ≠ **商用**：如果未来柠檬猫要做商用桌宠，需要替换为商用授权模型（也可以是 Natori 商用版，或自家画的猫）。

---

## ⚠️ 商用前必须替换

本 Demo 使用的 Natori 模型属于 [Live2D Free Material License Agreement](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)，仅供：

- ✅ 个人学习 / 教学 / 演示
- ✅ 个人非商业用途
- ❌ **不可商用**

商用前必须替换为商用授权模型，详见 `desktop-pet-shell/models/pet-human-natori/LICENSE.md`。

---

## 🔧 技术细节

- **PIXI.js 7.4.2** + **pixi-live2d-display 0.5.0**（CDN，与 Electron 桌宠壳版本一致）
- 模型路径：`/models/pet-human-natori/Natori.model3.json`
- 贴图路径：`/models/pet-human-natori/Natori.2048/texture_00.png`
- 滑块双向绑定：`model.internalModel.coreModel.parameters[idx].value`
- 动效：`model.motion("idle", 0)` / `model.motion("tap_body", 0)`
- 表情：`model.expression("Smile")` 等

---

## 📚 相关资料

- Live2D Natori 官方教程（身体/手臂演示）：<https://docs.live2d.com/en/cubism-editor-tutorials/natori_making/>
- pixi-live2d-display：<https://github.com/guansss/pixi-live2d-display>
- Live2D CubismWebSamples：<https://github.com/Live2D/CubismWebSamples>