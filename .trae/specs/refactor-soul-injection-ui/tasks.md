# Tasks
- [x] Task 1: 清理冗余代码与废弃逻辑
  - [x] SubTask 1.1: 在结果展示区彻底移除“假门测试”相关的升级、排队、Pro版按钮及弹窗组件。

- [x] Task 2: 重构前端阶段二“Soul Injection”表单 UI
  - [x] SubTask 2.1: 新增“专属命名”必填输入框。
  - [x] SubTask 2.2: 新增“灵魂性格”输入框或多选 Tag 组件。
  - [x] SubTask 2.3: 重构 AI 提取结果的展示方式，改为可删减/编辑的“AI 视觉底稿”胶囊 Tag。
  - [x] SubTask 2.4: 确保整体具有类似“RPG 游戏角色建立”或“赛博宠物领养登记”的高质感和流畅过渡动画。

- [x] Task 3: 实现前后端联调与终极 Prompt 组装逻辑
  - [x] SubTask 3.1: 在前端拦截用户提交的表单数据，并按格式 `"{petVibe} 的氛围与神态, {aiTags}, 补充特征: {customFeatures}"` 拼接，或将字段传递给后端处理。
  - [x] SubTask 3.2: 后端接收请求，确保最终绘图 Prompt 中性格词前置。

- [x] Task 4: 优化阶段四结果页情感化展示
  - [x] SubTask 4.1: 修改每张图底部的标题文案，动态渲染为“盲盒宇宙里的 {petName}”、“变成羊毛毡的 {petName}”等。
  - [x] SubTask 4.2: 在页面底部增加“再试一次”与“保存它的赛博档案”按钮。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 2