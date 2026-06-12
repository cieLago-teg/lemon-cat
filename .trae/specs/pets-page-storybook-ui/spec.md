# 我的宠物页面 · 水彩绘本风 UI 重构

## Why
当前 `/pets` 页面虽然经过"商业化减法重构"，但仍是带描边卡片 + 灰色阴影的"后台风"列表，与用户期望的"日系绘本/奶油系 + 水彩手绘"消费级审美差距明显。需要让"我的宠物"页面真正像一本温柔的"毛孩子相册"：标题手写字体、可爱胶囊标签、奶油背景、配图满版水彩，宠物本身成为绝对主角。

## What Changes
- 整体氛围：从"卡片网格 + 描边边框"切换为"奶油背景 + 软手绘装饰"的水彩绘本风
- 标题区：大号手写体标题「我的宠物」+ 装饰小爱心 + 旁注花藤，背景使用奶油色 + 米色水彩晕染
- 顶部统计：从"一行文字小统计"升级为"横向三宫格胶囊卡片"，每项带 emoji + 数字 + 标签（总宠物 / 互动总数 / 已召唤），使用奶油色背景 + 浅色边框，无阴影
- **真实数据原则**（hard rule）：所有展示数字必须从 PetArchive 真实数据派生，**禁止**任何占位 / 假数 / 兜底示例数字；"概念图"仅作设计参考，不提供真实数据
  - 总宠物 = archives.length
  - 互动总数 = Σ archive.interactionTotal（无则为 0，真实可达，不允许写"1,256"这种占位数）
  - 已召唤 = Σ (archive.deployedAt > 0)
- 左侧筛选器：固定左列"全部 / 活跃的 / 最喜欢"三段大胶囊按钮，选中态使用对应主题色（薄荷绿/桃粉/蜜糖橙）
- 右侧宠物网格：2-3 列布局，每张卡片：
  - 顶图区为水彩大画布（aspect 5:4），宠物图充满中央
  - 卡片左上角：桃粉小爱心（最喜爱的标识）
  - 卡片右上角：省略号"···"更多菜单
  - 卡片底部：名字（手写体）+ 状态胶囊（活跃中/休息中/最喜欢）+ 三个小图标按钮（点赞 / 评论 / 更多）
- 装饰元素：四角 + 底部边缘添加水彩植物/小猫装饰元素（左下小猫剪影、右下盆栽），背景为奶油渐变 + 极淡噪点
- 字体：标题用 Caveat / Ma Shan Zheng 手写体，统计数字用粗体大号数字，标签用 M PLUS Rounded 1c 圆体
- 主按钮：「＋ 创建新宠物」使用桃粉色胶囊 + 心形装饰
- 移除旧设计：移除之前的"白底 + 描边 + 阴影"卡片、移除原图 vs 数字形态的对比（让单一数字形象成为绝对主角）

## Impact
- Affected specs: 我的宠物页面 UI
- Affected code:
  - [app/pets/page.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/pets/page.tsx) — 整个文件重写
  - [app/layout.tsx](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/layout.tsx) — 引入 Google Fonts（Caveat / Ma Shan Zheng / M PLUS Rounded 1c）
  - [app/globals.css](file:///d:/TRAE/%E6%9F%A0%E6%AA%AC%E6%A0%91%E8%8B%97/app/globals.css) — 添加水彩背景 + 噪点 utility class

## ADDED Requirements
### Requirement: 水彩绘本风视觉风格
系统 SHALL 渲染"我的宠物"页面为日系水彩绘本风格：奶油背景、手写体标题、桃粉/薄荷绿主题色、装饰小元素，**禁止**使用冷灰色阴影、硬描边边框、锐利圆角矩形。

#### Scenario: 用户打开 /pets
- **WHEN** 用户进入"我的宠物"页面
- **THEN** 页面显示奶油色背景（#FFF8EE / 暖白 + 淡米色渐变）
- **AND** 左上大号手写体"我的宠物"标题
- **AND** 顶部居中三宫格统计胶囊（总宠物 18只 / 互动总数 1,256次 / 今日互动 32次）
- **AND** 右上角桃粉主按钮"＋ 创建新宠物"
- **AND** 左侧"全部/活跃的/最喜欢"分段胶囊
- **AND** 右侧 2-3 列宠物水彩卡片

#### Scenario: 宠物卡片渲染
- **WHEN** 列表展示某只宠物
- **THEN** 卡片包含：水彩大图（满版 aspect 5:4，无白边无圆角过深）+ 桃粉爱心（最喜爱标识）+ 名字（手写体）+ 状态胶囊（活跃中绿色/休息中橙色/最喜欢粉色）+ 三个小图标操作

#### Scenario: 筛选切换
- **WHEN** 用户点击"活跃的"
- **THEN** 选中态变薄荷绿 + 加深边框
- **AND** 列表过滤为只展示活跃宠物

### Requirement: 状态文案对齐
系统 SHALL 在 UI 中展示用户视角的状态标签：
- deployed → "活跃中"（薄荷绿）
- needs_fix → "待调整"（蜜糖橙）
- 默认 → "休息中"（淡灰色）
- 用户标记为最喜爱 → "最喜欢"（桃粉爱心）

#### Scenario: 状态映射
- **WHEN** archive.deployedAt > 0
- **THEN** 显示"活跃中"薄荷绿胶囊
- **WHEN** 用户标记某只宠物为最喜爱（新增 fav 字段，默认 false）
- **THEN** 卡片左上角显示桃粉爱心 + 状态显示"最喜欢"

## MODIFIED Requirements
### Requirement: 现有数据兼容
系统 SHALL 保留 PetArchive 现有 schema 完全兼容，仅在 UI 层扩展"最喜欢"标识（默认 false，从 needsFix 之外的 hasFav 字段读取）。无破坏性 schema 变更。

#### Scenario: 老数据展示
- **WHEN** 老 archive 无 hasFav 字段
- **THEN** 默认为 false，不显示爱心
- **AND** 其他字段（petName / species / results / deployedAt）正常展示

## REMOVED Requirements
### Requirement: 旧版"原图 vs 数字形象"双层对比
**Reason**: 消费级审美中"对比是后台逻辑"，单只水彩大图作为主角更符合绘本风
**Migration**: 仅在 /pets 列表移除 hover 时原图浮现的逻辑；详情页 /pets/[id] 仍保留原图/数字形象切换

### Requirement: 旧"更多菜单 ⋯" 弹层
**Reason**: 卡片底部已经有三个独立图标按钮（点赞/评论/更多），"···" 按钮在右上角重复
**Migration**: 右上角"···"改为只展示"标记最喜爱"toggle，删除/查看档案/重新生成等次操作进入 hover 浮出的小图标按钮组
