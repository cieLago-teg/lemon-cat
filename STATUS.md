\# STATUS.md



\## 当前阶段



模块 C：Generate



\## 当前任务



自进化 Skill 训练系统配置与首个 Skill 生成流程搭建



\## 当前状态



\- AGENTS.md 已建立或正在优化

\- 正在补齐项目模板文件

\- 等待第一个真实 Task Brief



\## 已完成



\- 确定项目最高验收标准：Skill 必须跑通真实任务

\- 确定模块流程：Ingest → Distill → Generate → Evaluate \& Iterate

\- 确定需要使用 Evaluation Report 记录验证过程

\- 确定规则库反写需要可追踪



下一步



1\. 新建 templates/ 下的模板文件

2\. 准备第一个真实 Task Brief

3\. 根据 Task Brief 生成第一个 Skill 包

4\. 跑真实任务验证

5\. 输出 Evaluation Report



风险与注意



\- 不要把动态进度写死在 AGENTS.md

\- 不要用玩具任务冒充真实任务

\- 没有 Evaluation Report 的 Skill 不能算正式通过


---

## 2026-06-30 · Live2D 真猫模型集成 (Natori → Cat Morph 阶段 2)

### 完成项
1. ✅ 从 npm 下载 Live2D 官方真猫模型：
   - `live2d-widget-model-hijiki@1.0.5` (黑猫，Cubism 2 格式) — 188KB moc + 232KB texture + 9 mtn
   - `live2d-widget-model-tororo@1.0.5` (白猫，Cubism 2 格式) — 188KB moc + 287KB texture + 9 mtn
   - 来源：npm 官方包 (Live2D Free Material License)
2. ✅ 下载 Cubism 2 Core (`live2d.min.js`, 129KB)
3. ✅ 创建独立测试页 `public/live2d-anatomy-demo/cats-test.html`（PIXI 6.5 + pixi-live2d-display 0.4.0 + Cubism 2 + 4 Core 并存）
4. ✅ 修复 Mao 按钮误导性标签（🐰 兔子法师 → 🧙 4 臂女巫）
5. ✅ 在主 demo `morph-cat.html` 集成 iframe 嵌入 cats-test.html（双 PIXI 版本完全隔离）
6. ✅ 验证：iframe 内 Hijiki/Tororo 均加载成功，canvas 渲染正常

### 经验教训
- pixi-live2d-display 0.5.0 移除了 Cubism 2 直加载支持 → 必须降到 0.4.0 才能加载 .moc
- 双 PIXI 版本（6.5/7.4）冲突 → iframe 隔离是零风险方案
- Live2D "Part" 命名不一定反映真实角色外观（PartRabbit ≠ 兔子角色）
- Live2D CubismWebSamples 官方样例模型大多是人形（带动物元素的"魔法少女"风格），不是真动物
- Live2D 官方免费模型 (Hijiki/Tororo) 是最干净的真猫来源，但版本停留在 Cubism 2

### 待办
- [x] 升级 cats-test.html → 加交互按钮（随机互动/待机/甩头/摸头） + 飘落猫爪装饰
- [x] 摸头反馈通过 setParamFloat 驱动 PARAM_ANGLE_X / PARAM_ANGLE_Y 实现头部摆动
- [ ] （可选）下载并测试更多真动物模型：Ezri Little Cat, chycero Cat（itch.io 需登录）
- [ ] （可选）实现 iframe 与主 demo 的双向通信（点击主 demo 模型同步切换 iframe 内猫）
- [ ] （可选）尝试用 Cubism 2 → Cubism 4 转换工具，让主 demo 直接加载 .moc

