# 数字宠物克隆 Demo Web 规格

## Why
当前需要一个可演示的最小可用 Demo，把“宠物照片 -> 特征提取 -> 多风格生成”完整打通。  
同时必须确保 AI 链路 100% 使用阿里云百炼 API，便于后续稳定扩展与统一合规。

## What Changes
- 使用 Next.js App Router + TailwindCSS 搭建单页极简上传与结果展示界面
- 前端在上传阶段执行图片压缩（<=2MB）并转为百炼可接收格式（Base64）
- 新增后端 `route.ts`：阶段一调用 `qwen3-vl-plus` 提取宠物中文特征
- 新增后端 `route.ts`：阶段二基于 `pet_features` 使用 `Promise.all` 并发调用 4 次 `qwen-image-2.0-pro`
- 固化 4 套风格 Prompt 模板并以字符串拼接方式注入 `[宠物特征]`
- 前端以 2x2 宫格展示 4 张图，标注风格名并支持单图保存
- 新增“假门测试”高亮按钮与内测提示 Modal，不触发复杂业务流程
- 明确依赖配置与阿里云 SDK/API 接入方式，仅允许阿里云百炼链路

## Impact
- Affected specs: 图片上传与预处理、视觉特征提取、并发文生图、结果画廊展示、交互提示弹窗、阿里云百炼接入规范
- Affected code: `app/page.tsx`、`app/api/clone/route.ts`、`lib/bailian.ts`、`lib/prompts.ts`、`components/*`、`package.json`、环境变量配置文件

## ADDED Requirements
### Requirement: 纯阿里云百炼 AI 链路
系统 SHALL 在特征提取与图片生成阶段仅调用阿里云百炼相关 API，不得依赖其他第三方 AI 平台。

#### Scenario: 特征提取模型约束
- **WHEN** 后端接收到宠物图片输入
- **THEN** 必须调用 `qwen3-vl-plus` 进行图像理解与中文特征提取

#### Scenario: 文生图模型约束
- **WHEN** 后端获得 `pet_features`
- **THEN** 必须调用 `qwen-image-2.0-pro` 完成风格化图片生成

### Requirement: 前端上传与预处理
系统 SHALL 在前端上传后先进行压缩并保证图片体积不超过 2MB，再传输为后端可直接用于百炼请求的格式。

#### Scenario: 图片超过阈值
- **WHEN** 用户上传的原图大于 2MB
- **THEN** 前端自动压缩至阈值内并继续流程

#### Scenario: 格式标准化
- **WHEN** 前端完成压缩
- **THEN** 输出 Base64 或等价百炼支持格式提交到 API

### Requirement: 两阶段生成流程
系统 SHALL 先执行“特征提取”，后执行“并发风格生成”，且阶段二并发数固定为 4。

#### Scenario: 成功链路
- **WHEN** 阶段一返回 `pet_features`
- **THEN** 阶段二通过 `Promise.all` 并发执行 4 个风格请求并聚合结果

### Requirement: 风格 Prompt 模板注入
系统 SHALL 将 `pet_features` 以字符串拼接方式注入 4 个内置模板中的 `[宠物特征]` 占位符。

#### Scenario: 模板拼接
- **WHEN** 触发某个风格生成
- **THEN** 发送给百炼的 Prompt 必须包含该风格模板全文与注入后的特征文本

### Requirement: 结果展示与保存
系统 SHALL 在前端展示四宫格结果，每张图显示风格名并支持保存图片。

#### Scenario: 结果渲染
- **WHEN** 后端返回 4 张图片 URL
- **THEN** 前端按 2x2 网格展示并附带对应风格名称

#### Scenario: 图片保存
- **WHEN** 用户点击某张图的“保存图片”
- **THEN** 浏览器触发该图片下载

### Requirement: 状态感知与假门测试交互
系统 SHALL 在处理中显示“治愈感+科技感”加载动画文案，并提供高亮按钮触发内测提示弹窗。

#### Scenario: 加载反馈
- **WHEN** 用户提交上传并等待 AI 处理
- **THEN** 页面展示如“正在提取数字灵魂...”等动态文案与 Loading 动画

#### Scenario: 假门按钮
- **WHEN** 用户点击“特征不准？上传 10 张图生成 100% 专属克隆体”
- **THEN** 仅弹出提示“专属克隆模型训练功能正在内测中，当前有 1204 人排队，敬请期待。”

## MODIFIED Requirements
### Requirement: 无
当前变更为新增能力，不修改既有规格。

## REMOVED Requirements
### Requirement: 无
**Reason**: 当前无移除项。  
**Migration**: 不涉及迁移。
