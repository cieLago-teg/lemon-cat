# Tasks

- [x] Task 1: 背景图准备
  - [x] SubTask 1.1: 制作 1920×1200 暖木板 + 木架 + 麻绳 + 便签背景图，保存到 public/backgrounds/pets-wall.jpg — **等用户把原图放进来**
  - [x] SubTask 1.2: 在 globals.css 添加 `.bg-wallpaper` utility（fixed cover, center）

- [x] Task 2: /pets 页面布局重组
  - [x] SubTask 2.1: 整页外壳从 `bg-storybook` 改为 `bg-wallpaper`
  - [x] SubTask 2.2: 顶部加 220-380px（响应式）空区，不放任何功能性 UI
  - [x] SubTask 2.3: 标题「我的宠物」从页面顶部下沉到背景图的中下留白区
  - [x] SubTask 2.4: 三宫格统计胶囊改用半透明白底 + backdrop-blur
  - [x] SubTask 2.5: 左侧筛选栏 + 宠物卡片网格下沉到中下区域，使用半透明白底 + backdrop-blur

- [x] Task 3: 响应式适配
  - [x] SubTask 3.1: 桌面端（≥1024px）顶部空区 380px
  - [x] SubTask 3.2: 平板（640~1024px）顶部空区 300px
  - [x] SubTask 3.3: 手机（<640px）顶部空区 220px

- [x] Task 4: 冷重启 + 验证
  - [x] SubTask 4.1: tsc --noEmit 0 错误
  - [x] SubTask 4.2: 杀掉 dev server + 清 .next 缓存
  - [x] SubTask 4.3: 重启 dev server
  - [x] SubTask 4.4: 浏览器唤起 /pets 验收：HTTP 200 / 5 个核心文案命中 / bg-wallpaper class 已生效

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 1-3
