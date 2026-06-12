# Tasks
- [x] Task 1: 初始化 Next.js App Router + TailwindCSS 项目骨架并配置环境变量读取。
  - [x] SubTask 1.1: 建立 `app` 目录基础页面与全局样式入口
  - [x] SubTask 1.2: 配置 TailwindCSS 与必要构建依赖
  - [x] SubTask 1.3: 约定并读取阿里云百炼访问密钥与模型参数

- [x] Task 2: 实现前端上传与预处理能力，保证图片压缩到 2MB 内并标准化编码。
  - [x] SubTask 2.1: 构建首页上传组件与文件校验
  - [x] SubTask 2.2: 实现浏览器端压缩逻辑与 Base64 转换
  - [x] SubTask 2.3: 对接提交动作与加载态文案动画

- [x] Task 3: 实现后端 `app/api/clone/route.ts` 两阶段阿里云百炼处理流程。
  - [x] SubTask 3.1: 阶段一调用 `qwen3-vl-plus` 提取中文宠物特征
  - [x] SubTask 3.2: 基于 `pet_features` 拼接 4 套风格 Prompt
  - [x] SubTask 3.3: 使用 `Promise.all` 并发调用 4 次 `qwen-image-2.0-pro`
  - [x] SubTask 3.4: 统一响应结构并返回风格名与图片 URL

- [x] Task 4: 实现结果展示层，完成 2x2 宫格、风格标注与图片保存。
  - [x] SubTask 4.1: 渲染四宫格卡片与风格标签
  - [x] SubTask 4.2: 为每张结果图提供“保存图片”下载能力
  - [x] SubTask 4.3: 补充空态、异常态与重试入口

- [x] Task 5: 实现“假门测试”高亮按钮与提示 Modal 的完整交互。
  - [x] SubTask 5.1: 添加醒目按钮与视觉强调样式
  - [x] SubTask 5.2: 点击后弹出内测提示文案 Modal
  - [x] SubTask 5.3: 确保不触发任何后端复杂逻辑

- [x] Task 6: 验证与收敛，确保链路仅使用阿里云百炼并满足体验要求。
  - [x] SubTask 6.1: 本地运行并验证上传、加载、生成、展示全流程
  - [x] SubTask 6.2: 校验请求仅指向阿里云百炼接口与指定模型
  - [x] SubTask 6.3: 修复验证阶段发现的问题并完成最终自测记录

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 2
- Task 6 depends on Task 3, Task 4, and Task 5
