# Random Loop Playlist Design

**Date:** 2026-07-08  
**Project:** 柠檬猫 (Lemon Cat)  
**Topic:** 多段 5 秒循环视频的随机不重复播放

## Goal

把当前“单段 5 秒桌宠循环视频”升级成“多段独立 5 秒循环片段 + 运行时随机不重复播放”的系统。

目标不是把一段视频拉长，而是让桌宠在运行时从 2 到 3 段不同的小循环里随机切换，从而：

- 降低用户对“5 秒后开始重复”的感知
- 在不牺牲首尾回正能力的前提下，给动作更多自由度
- 保持现有透明抠像、桌宠部署、档案保存链路基本可复用

非目标：

- 第一版不做“预拼接成一个 10-15 秒大视频”
- 第一版不做复杂状态机、权重系统、冷却系统
- 第一版不做用户可配置的片段数量和动作库编辑器

## Context

当前系统现状：

- `/api/pet/animate` 一次只生成 1 段 KF2V 视频
- `lib/pet/animation-prompt.js` 只为“单段 idle loop”生成提示词
- `desktop-pet-shell/renderer.js` 只支持单个 `<video>` 的循环播放
- 档案层默认只存单个 `videoUrl`

当前问题：

- 单段 5 秒循环虽然已经比之前更稳，但用户仍容易感知到循环
- 为了让单段首尾完全回正，动作幅度会被压缩，导致“太静”“太死板”
- 单段视频天然缺少“偶发行为”的感觉，不像真实宠物

## Recommendation

第一版采用：

- 固定生成 **3 段** 5 秒小循环
- 每段都使用 **同一张 source image 作为 first_frame_url 和 last_frame_url**
- 每段用 **不同的动作模板 prompt**
- 桌宠运行时采用 **random_no_repeat** 策略随机播放
- 老数据继续兼容单个 `videoUrl`

推荐理由：

- 比“固定顺序三段循环”更自然
- 比“权重状态机”更容易快速落地
- 比“预拼接大视频”更接近真实的运行时行为
- 复用现有生成、抠像、投放链路最多

## Action Library V1

第一版动作库不追求夸张动作，先做中等自由度的三段，保证能回到起始姿态。

### Segment A: `breathe_relaxed`

意图：

- 平静呼吸
- 胸、肩、头轻微联动
- 作为最稳定、最常出现的一段

特点：

- 最接近当前 v4 的“基础待机”
- 风险最低

### Segment B: `ear_tail_attention`

意图：

- 轻呼吸
- 耳朵对环境做一次小反应
- 尾尖慢摆

特点：

- 给用户“它有感知外界”的感觉
- 幅度中等，可控

### Segment C: `posture_adjust`

意图：

- 轻微重心调整
- 前爪或肩线做很小的复位动作
- 最终回到原姿态

特点：

- 提供最明显的“不是一张图在喘气”的观感
- 但仍控制在 loop-safe 的范围内

明确不纳入 v1 的动作：

- 挠头
- 转头幅度很大的凝视
- 大摆尾
- 站起/坐下/转身

这些动作在 KF2V 下更容易破坏首尾回正，适合 v2 再试。

## Architecture

### 1. Generation Layer

新增“多段生成”的 orchestrator，但保留现有单段生成函数。

建议结构：

- 保留 `runJobForTask()` 负责单段生成
- 新增 `runPlaylistJobForTask()` 负责 3 段编排
- 由 `/api/pet/animate` 决定走单段还是多段

第一版直接让 `/api/pet/animate` 默认产出 playlist，返回的数据形态包含：

```ts
{
  ok: true,
  taskId,
  provider: "dashscope_wan",
  mode: "playlist"
}
```

轮询完成后的成功态返回：

```ts
{
  stage: "Success",
  videoPlaylist: {
    version: 1,
    strategy: "random_no_repeat",
    segments: [
      { videoUrl: "/pet-videos/xxx-a-matted.webm", action: "breathe_relaxed" },
      { videoUrl: "/pet-videos/xxx-b-matted.webm", action: "ear_tail_attention" },
      { videoUrl: "/pet-videos/xxx-c-matted.webm", action: "posture_adjust" }
    ]
  }
}
```

单段函数继续保留，作为：

- 老客户端兼容路径
- 某些片段失败时的降级路径

### 2. Prompt Layer

`lib/pet/animation-prompt.js` 从“只生成一个默认 idle prompt”升级为：

- `buildIdlePrompt(input, styleHint)`：继续保留，兼容旧链路
- 新增 `buildLoopSegmentPrompt({ actionKey, styleHint, customPrompt })`

规则：

- 共用一套 loop-safe 基础约束
- 每个 `actionKey` 只附加本段动作意图
- 所有片段都必须带“回到起始姿态”的约束

这样一来，三段之间的差异来自动作模板，而不是随机碰运气。

### 3. Archive/Data Layer

档案结果从单个 `videoUrl` 扩展到可选的 `videoPlaylist`。

建议数据结构：

```ts
type PetVideoSegment = {
  videoUrl: string;
  action: "breathe_relaxed" | "ear_tail_attention" | "posture_adjust";
};

type PetVideoPlaylist = {
  version: 1;
  strategy: "random_no_repeat";
  segments: PetVideoSegment[];
};
```

在 morph 结果对象中新增：

```ts
{
  style: string,
  imageUrl: string,
  videoUrl?: string,
  videoPlaylist?: PetVideoPlaylist
}
```

兼容规则：

- 有 `videoPlaylist` 时优先播放 playlist
- 没有 `videoPlaylist` 但有 `videoUrl` 时走旧逻辑
- 两者都没有时才触发重新生成

### 4. Deploy Layer

`useDeployPet.ts` 和 `/api/pet/set-video` 需要从“只部署单个视频”升级成“可部署 playlist”。

建议：

- `useDeployPet` 返回值里新增 `videoPlaylist`
- `/api/pet/set-video` 支持接收：
  - `videoUrl`
  - 或 `videoPlaylist`

配置写入 `desktop-pet-shell/config.json` 时：

- 单段：继续写 `{ mode: "video", src: "pet-video.webm" }`
- playlist：写成类似

```json
{
  "mode": "video_playlist",
  "strategy": "random_no_repeat",
  "segments": [
    { "src": "pet-video-0.webm", "action": "breathe_relaxed" },
    { "src": "pet-video-1.webm", "action": "ear_tail_attention" },
    { "src": "pet-video-2.webm", "action": "posture_adjust" }
  ]
}
```

## Playback Design

### Current

当前 `desktop-pet-shell/renderer.js` 是单 `<video>` 循环：

- 设置 `src`
- `loop = true`
- `play()`

### New

新增 playlist 模式：

- `mode === "video"`：保持旧逻辑
- `mode === "video_playlist"`：进入新逻辑

核心行为：

1. 初始化时随机选第一段
2. 关闭 `loop`
3. 监听 `ended`
4. 从 segments 中选择下一段
5. 选择规则：
   - 不能与上一段相同
   - 至少有 2 段时一定换段
   - 只有 1 段时退化为单段 loop
6. 切换 `src` 并 `play()`

第一版不做预加载，但播放器代码要留出“预加载下一段”的扩展点。

## Random Strategy

第一版随机策略使用：

`random_no_repeat`

算法：

```ts
nextIndex = random(allIndexes except currentIndex)
```

如果 segments 只有 1 个：

- 直接重复这一段

如果有 2-3 个：

- 永不连续重复

第一版不实现：

- 权重
- 冷却
- 段落优先级
- 行为概率配置

这些都可以留到 v2。

## Failure Handling

### Generation Failure

3 段里任意一段失败时的策略：

- 如果成功段数 >= 2：仍然产出 playlist，只包含成功段
- 如果成功段数 == 1：降级为单段 `videoUrl`
- 如果成功段数 == 0：整任务失败

这样可避免“因为第三段失败，前两段也浪费”的问题。

### Deployment Failure

如果 playlist 写盘时某一段复制失败：

- 整次 set-video 失败
- 不更新 config
- 返回明确错误

原因：播放器拿到残缺 playlist 比明确失败更难排查。

### Playback Failure

如果当前片段 `error`：

- 尝试切到下一段
- 连续多段都失败时显示 HUD：`视频资源加载失败`
- 如果 config 中仍有可用单段 `videoUrl`，可作为兜底回退

## Testing

### Unit Tests

建议新增或修改以下测试：

- `animation-prompt`：
  - 每个 actionKey 都能产出不同的 prompt
  - 仍包含首尾回正约束
- `animation-status` / route source：
  - success payload 可返回 `videoPlaylist`
- deploy helper：
  - playlist 写 config 的结构正确
  - `random_no_repeat` 选择器不会连续重复

### Integration Checks

至少验证：

1. 生成 3 段时 public/pet-videos 下有 3 个 `-matted.webm`
2. 档案中写入 `videoPlaylist`
3. set-video 后 `desktop-pet-shell/config.json` 为 `video_playlist`
4. renderer 可以在 `ended` 后切到下一段
5. 相邻片段不重复

### Manual QA

亲爱的 cieLago 重点验收：

- 用户是否还能看出“5 秒一轮”的重复
- 三段动作是否足够区分
- 切段时是否有闪烁/黑帧
- 有无某一段明显更僵硬或更假

## Rollout

建议 rollout 分两步：

### Phase 1

- 内部默认生成 3 段
- 只给当前档案库按钮使用
- 先不改 create 页面主流程文案

### Phase 2

- 如果动效提升明显，再把 create 页成功流也切到 playlist
- 再考虑把动作库扩到 4-5 段

## Open Decisions Resolved

本次已经确定：

- 直接做运行时随机播放，不做预拼接
- 第一版做 3 段，不做 2 段可配置
- 第一版随机策略为 `random_no_repeat`
- 第一版动作库不含高遮挡、高幅度动作

## Acceptance Criteria

以下条件全部满足，才算第一版完成：

- 档案生成出的动态结果支持 `videoPlaylist`
- 桌宠运行时能在 3 段间随机切换
- 任意时刻不会连续播放同一段两次
- 老的单段 `videoUrl` 档案仍然可以正常播放
- 至少 2 段成功时仍可生成可用结果
- `npm run typecheck` 通过
- 手工验收时，用户不再容易一眼察觉“5 秒重复”
