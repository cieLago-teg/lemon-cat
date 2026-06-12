# 我的宠物页面 · 暖木板背景 + 顶部留白布局

## Why
用户期望 `/pets` 页面以一张「暖色木板 + 麻绳 + 空白便签」的自然木质感背景图作为整页底图，且要把 **页面最上方留出**（让背景图里的木架 / 麻绳 / 便签装饰完整可见），所有功能性的内容（标题、统计、筛选、卡片）**下沉到背景图的留白区**（即图片下半部分）。

## What Changes
- 整页底图：用一张新背景图 `public/backgrounds/pets-wall.jpg` 替代当前 `bg-storybook` CSS 渐变背景，作为整页 `<body>` 固定背景
- 布局重组：
  - 顶部"留白"区：大约 360px - 440px 高度（视窗响应式），让背景图里的木架 + 麻绳 + 便签完整露出
  - 中部"装饰"区：可选地放一个透明大标题 / 一句 slogan（不抢戏）
  - 下部"功能"区：从 ~50% 视口位置开始，放：标题「我的宠物」 + 三宫格统计 + 左侧筛选 + 宠物网格
- 文案/元素"长留白"：
  - 标题「我的宠物」下沉到背景留白区（图片中下位置），手写体奶油色 + 花藤装饰
  - 三宫格胶囊：使用半透明白底 + backdrop-blur，融在背景图上
  - 卡片：使用半透明白底 + backdrop-blur，融在背景图上
  - 装饰元素（左下小猫剪影 + 右下盆栽）：保留，作为前景的"绘本感"装饰，与背景图自然叠加
- 数据原则（继承自上一个 spec）：所有数字必须从 PetArchive 真实数据派生，0 假数
- 字体、颜色、动效：与上一个 spec 完全一致

## Impact
- Affected specs: 我的宠物页面 UI（继承 pets-page-storybook-ui）
- Affected code:
  - [app/pets/page.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/pets/page.tsx) — 重组布局：背景图 + 顶部留白 + 功能区下沉
  - [app/globals.css](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/globals.css) — 新增 `.bg-wallpaper` utility，整页 fixed 背景
  - [app/components/AppNav.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/components/AppNav.tsx) — 全局 AppNav 改为半透明白磨砂 + 极淡下边线
  - [app/layout.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/layout.tsx) — body 改 `bg-transparent`，让背景图从最顶端覆盖
  - [public/backgrounds/pets-wall.jpg](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/public/backgrounds/pets-wall.jpg) — 1920×1200 暖木板背景图（**由用户提供原图，禁止自画**）

## ADDED Requirements
### Requirement: 整页固定背景图
系统 SHALL 在 `/pets` 页面使用 `public/backgrounds/pets-wall.jpg` 作为整页 fixed 背景，背景图覆盖 100vw × 100vh，超出部分从底部或右侧自然裁剪。

#### Scenario: 打开 /pets
- **WHEN** 用户进入"我的宠物"页面
- **THEN** 整个视口显示暖木板背景图
- **AND** 滚动时背景图保持 fixed 不动
- **AND** 文字 / 卡片 / 按钮等前景元素全部使用半透明白底 + backdrop-blur，融在背景上

### Requirement: 顶部留白区
系统 SHALL 在 `/pets` 页面顶部保留一个**空区**（不放置任何功能性 UI），让背景图里的木架 / 麻绳 / 便签完整可见。

#### Scenario: 首屏视口
- **WHEN** 视口高度 ≥ 800px
- **THEN** 顶部 0 ~ 360px 范围为空（仅背景图 + 顶部导航 + 可选透明标题）
- **WHEN** 视口高度 < 800px
- **THEN** 顶部空区高度响应式压缩到 280 ~ 320px
- **WHEN** 视口宽度 < 640px
- **THEN** 顶部空区高度进一步压缩到 220 ~ 260px

### Requirement: 功能区下沉到背景留白
系统 SHALL 把以下功能元素全部放在背景图的中下留白区：
- 标题「我的宠物」
- 三宫格统计胶囊
- 左侧筛选栏
- 宠物卡片网格
- 装饰元素（左下小猫 / 右下盆栽）

#### Scenario: 用户滚动
- **WHEN** 用户从顶部开始向下滚动
- **THEN** 第一屏只看到背景图 + 顶部导航 + 装饰标题
- **AND** 向下滚动后看到三宫格统计胶囊
- **AND** 继续滚动后看到筛选栏 + 宠物网格

### Requirement: 真实数据原则（继承）
所有展示数字必须从 PetArchive 真实数据派生，**禁止**任何占位 / 假数 / 兜底示例数字。

## MODIFIED Requirements
### Requirement: 删除旧 CSS 渐变背景
**Reason**: 整页改用真实背景图，旧 `.bg-storybook` 渐变不再需要
**Migration**: `.bg-storybook` utility 保留在 globals.css（不删），但 `/pets` 页面不再使用，改为 `.bg-wallpaper` 引用 jpg 文件

### Requirement: AppNav 改成半透明磨砂（2026-06-10 追加）
**Reason**: 用户反馈 AppNav 的 `bg-amber-50/70` 淡黄底与背景图冲突，要求"磨砂效果和底图做区分"
**Migration**:
- `<header>` 改为 `border-b border-amber-900/5 bg-white/30 backdrop-blur-lg supports-[backdrop-filter]:bg-white/20`
- 即"白色 30% 透明度 + 16px 模糊"作为基础，支持 backdrop-filter 的浏览器进一步降到 20% 透明度
- 极淡的暖棕下边线（5%）作为 nav 和背景图的视觉边界

### Requirement: 磨砂宽度只在内层 div（2026-06-10 追加 · 关键修正）
**Reason**: 之前三次都只改内层 div 的 `max-w`，但 `bg-white/30 backdrop-blur-lg` utility 一直挂在 `<header>` 元素上（默认全宽 1440px），导致无论内层 div 多窄，**磨砂区域都是 1440px 全宽**。用户反馈"修改了三次都没有效果"
**Migration**:
- `<header>` 改为 `sticky top-0 z-30 bg-transparent`（去掉磨砂和 border，header 只起 sticky 定位）
- 把磨砂 utility 移到内部 div：`mx-auto max-w-sm border-b border-amber-900/5 bg-white/30 px-6 py-5 backdrop-blur-lg supports-[backdrop-filter]:bg-white/20 sm:py-6`
- 内部 div 加 `mx-auto` 居中显示
- 现在磨砂真正只显示在 384px 宽的中央区域，header 两侧背景图完全透出

### Requirement: 磨砂宽度 768px + 两侧保留淡虚化（2026-06-10 追加 · 二次修正）
**Reason**: 上一步把磨砂改成 384px 孤立小药丸后，用户反馈"两侧的虚化部分直接没了"——要的是**宽度变窄但两侧虚化感保留**，不是变成孤立小药丸
**Migration**:
- `<header>` 改为 `sticky top-0 z-30 border-b border-amber-900/5 bg-white/15 backdrop-blur-md supports-[backdrop-filter]:bg-white/10`
  - header 整体 1440px 保持**10% 淡磨砂 + 12px 模糊**（满足"两侧虚化感保留"）
  - border-b 边线作为顶栏底部分隔
- 内部 div 改为 `mx-auto max-w-3xl bg-white/30 px-6 py-5 backdrop-blur-lg supports-[backdrop-filter]:bg-white/20 sm:py-6`
  - 内部 div **居中 768px 宽**（满足"宽度变窄"，字面意义的原来一半多一点）
  - 内部 div 有**20% 浓磨砂 + 16px 模糊**（满足"中央突出"）
  - 不重复 border-b（只在 header 上）
- 最终效果：header 1440px 淡磨砂（10% 透明） + 中央 768px 浓磨砂（20% 透明），形成"中央突出、两侧弱化"的双层磨砂条

### Requirement: AppNav 缩宽 + 删 logo + nav 链接手写体加粗（2026-06-10 追加）
**Reason**: 用户希望 AppNav 更克制：内层 div 宽度从 6xl 缩到 3xl，删掉左侧 logo 区域（"🐾 数字宠物档案馆 让它的灵魂永远陪着你"），三个 nav 链接字体切换成和 h1 一致的 `font-handwriting` (Ma Shan Zheng) 并加粗
**Migration**:
- 外层 div：`max-w-6xl` → `max-w-3xl`（从 1152px 缩到 768px）
- 对齐方式：`justify-between` → `justify-center`（删 logo 后三个链接居中）
- 删除 logo `<Link>` 节点（含 🐾 emoji + "数字宠物档案馆" + "让它的灵魂永远陪着你"）
- 三个 nav 链接：`text-[13px] font-semibold/font-normal` → `font-handwriting font-bold text-base`（16px），统一为 h1 同款 Ma Shan Zheng 手写体加粗
- 颜色不变：激活态 `text-amber-900`，未激活 `text-amber-700/80 hover:text-amber-900`

### Requirement: AppNav 内层 div 再缩到 384px（2026-06-10 追加）
**Reason**: 用户反馈 `max-w-3xl` (768px) 还是太宽，要求"缩小到原来的一半"
**Migration**:
- 外层 div：`max-w-3xl` (768px) → `max-w-sm` (384px)
- 三个 nav 链接紧凑居中显示，配合手写体 + 加粗更克制

### Requirement: /companion 删除桌面预览和陪伴方式（2026-06-10 追加）
**Reason**: 用户要求"把桌面预览的相关功能和UI全部删了，aside 包括选择陪伴方式的相关内容也是，全部删了"——做减法重构
**Migration**:
- 完全重写 [app/companion/page.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/companion/page.tsx)，从 975 行简化到 238 行
- 删除组件：`CenterPreview`（桌面预览）、`PetAtCorner`（宠物在角落）、`RightPanel`（陪伴方式 + 出现方式）、`CompanionAnimCSS`（桌面模拟器动效）、`FieldSelect` / `FieldSegment` / `FieldToggle`（折叠表单）
- 删除状态：`draftMode` / `draftCfg` / `dirty` / `saving` / `summoning` / `summonResult` / `previewZoom` / `activeArchive`
- 删除回调：`setMode` / `patchCfg` / `handleSave` / `handleSummon` / `modeMeta` / `currentMorph`
- 删除常量：`MODES` / `POSITION_LABEL` / `SIZE_LABEL` / `NEST_LABEL`
- 删除 types：`CompanionMode` / `CompanionConfig` / `CompanionNest` / `CompanionPosition` / `CompanionSize` / `SummonResult` / `ModeMeta`
- 删除 imports：相关 type 与默认值
- 页面布局从"左列选择 + 中列预览 + 右列陪伴方式"三列，**简化为"单列选择宠物列表"**
- 主召唤按钮"召唤到桌面"移除（删除桌面预览后此按钮无意义，由 Electron 客户端的物理召唤流程替代）
- 保留：顶部 header（标题 + DesktopAppStatus）、单列 PetList 组件、EmptyState 空状态
- PetList 中：选中态的卡片加 "已选" 标签，配合磨砂白底和悬停态

### Requirement: 背景图从页面最顶端覆盖（2026-06-10 追加 · 二次修正）
**Reason**: 用户要求"把整张背景图上移，从页面最上方开始放而不是从 div 下方开始"；第一次尝试把 `bg-wallpaper-archive` utility 挂在 main 元素上时，因 `position: sticky` 的 AppNav 是 main 的兄弟元素，background-attachment: fixed 在 sticky 兄弟元素场景下渲染不可靠，AppNav 区域依然没有背景图
**Migration**:
- 不再把 `bg-wallpaper-archive` utility 挂在 main 元素上
- 改为在 main 内部第一个子元素位置，放一个**真正 fixed 定位**的独立 div：
  ```tsx
  <div
    aria-hidden
    className="pointer-events-none fixed inset-0 -z-10 bg-wallpaper-archive bg-wallpaper-cover"
  />
  ```
- 这个 div `position: fixed; inset: 0; -z-10`，铺满整个视口（1440×900），必然覆盖 AppNav 位置
- z-index -10 在所有内容之下；AppNav z-30 浮在最上
- 三个页面统一处理：/pets, /create, /companion

### Requirement: 装饰元素叠层
**Reason**: 背景图里已经有"小猫剪影 + 盆栽"元素感，再叠 SVG 装饰会冲突
**Migration**: 保留左下水彩小猫剪影和右下盆栽作为前景装饰（叠在背景图上），与背景图自然融合

## REMOVED Requirements
无
