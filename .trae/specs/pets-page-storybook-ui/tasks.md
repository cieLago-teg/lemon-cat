# Tasks

- [x] Task 1: 全局水彩绘本基础
  - [x] SubTask 1.1: 在 layout.tsx 引入 Google Fonts (Caveat / Ma Shan Zheng / M PLUS Rounded 1c / Long Cang)
  - [x] SubTask 1.2: 在 globals.css 添加奶油色水彩背景 utility + 极淡噪点

- [x] Task 2: 重构 /pets 页面整体布局
  - [x] SubTask 2.1: 重写页面外壳：奶油背景 + 左标题装饰 + 中统计胶囊 + 右上"创建新宠物"主按钮
  - [x] SubTask 2.2: 重写顶部三宫格统计胶囊（总宠物 / 互动总数 / 已召唤），每项用 emoji 装饰，数据从 archives 真实派生（0 假数）
  - [x] SubTask 2.3: 实现左侧固定列"全部 / 活跃的 / 最喜欢"三段大胶囊，激活态使用对应主题色

- [x] Task 3: 重构宠物卡片为水彩绘本风
  - [x] SubTask 3.1: 卡片整体：无锐利圆角矩形阴影、改为软手绘边 + 水彩画布
  - [x] SubTask 3.2: 卡片顶部大图：aspect 5:4 满版水彩画布，宠物图 object-contain 居中
  - [x] SubTask 3.3: 卡片左上角桃粉爱心（hasFav=true 时显示）+ 右上角省略号
  - [x] SubTask 3.4: 卡片底部：名字（手写体） + 状态胶囊（活跃中绿/休息中橙/最喜欢粉） + 三图标按钮（点赞/召唤/更多）
  - [x] SubTask 3.5: 卡片 hover 动效：微微上浮 + 阴影柔化

- [x] Task 4: 装饰元素
  - [x] SubTask 4.1: 页面左下角水彩小猫剪影 SVG 装饰
  - [x] SubTask 4.2: 页面右下角水彩盆栽装饰
  - [x] SubTask 4.3: 标题旁添加花藤 + 桃粉小爱心装饰
  - [x] SubTask 4.4: 背景四角添加淡米色水彩晕染（CSS 渐变 + 噪点）

- [x] Task 5: 状态字段扩展与状态映射
  - [x] SubTask 5.1: 在 PetArchive 添加 hasFav / interactionTotal / interactionToday 字段（默认 false/0），向后兼容
  - [x] SubTask 5.2: 添加"标记最喜爱"PATCH 接口（toggle）
  - [x] SubTask 5.3: UI 状态映射：fav→"最喜欢"粉 / deployed→"活跃中"绿 / needsFix→"待调整"橙 / 默认→"休息中"灰

- [x] Task 6: 冷重启 + 验证
  - [x] SubTask 6.1: tsc --noEmit 0 错误
  - [x] SubTask 6.2: 杀掉 dev server + 清 .next 缓存
  - [x] SubTask 6.3: 重启 dev server（回到 3000 端口）
  - [x] SubTask 6.4: 浏览器唤起 /pets 验收：HTTP 200 / 浏览器无错 / 核心文案命中
