---
name: "anti-rot-setup"
description: "执行项目防腐规范设置。包含锁定依赖版本、配置 Git Hooks、重构鉴权逻辑等规范。当用户要求初始化项目规范或执行 anti-rot-setup 时调用。"
---

# anti-rot-setup

一套用于防止代码腐化的项目初始化规范设置。

## 主要规范内容

1.  **锁定依赖 (Lock Dependencies)**
    -   确保 `package-lock.json` 或 `pnpm-lock.yaml` 被提交到版本控制中。
    -   在构建和部署过程中使用 `npm ci` 或 `pnpm install --frozen-lockfile` 以确保依赖版本的一致性。

2.  **配置 Git Hooks**
    -   使用 `husky` 结合 `lint-staged`。
    -   在每次提交代码前运行 `npm run lint` 和 `npm run typecheck`。
    -   防止不符合规范的代码进入代码库。

3.  **重构鉴权逻辑 (Auth Refactor)**
    -   将分散的 API Key 读取和鉴权逻辑集中化。
    -   建立统一的 `lib/auth.ts` 管理所有环境变量和权限验证。
    -   确保 Key 的使用是安全的且易于更换。

## 执行步骤

1.  安装 `husky` 和 `lint-staged`：`npx husky-init && npm install`。
2.  配置 `.husky/pre-commit`：执行 `npm run lint` 和 `npm run typecheck`。
3.  在 `package.json` 中配置 `lint-staged`：
    ```json
    "lint-staged": {
      "**/*.{js,jsx,ts,tsx}": [
        "eslint --fix"
      ]
    }
    ```
4.  创建或重构 `lib/auth.ts`，导出统一的鉴权助手。
5.  修改所有 API 路由以使用新的鉴权逻辑。
