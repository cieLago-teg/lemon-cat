# AGENTS.md

## Project Overview

这是一个**自进化 Skill 训练系统**。

核心目标：从优质样本中学习规律，生成高质量的 SOLO Skill 包，并通过真实任务验收来迭代规则库与 Skill 生产流程。

最高验收标准只有一条：

> **生成的 Skill 能跑通真实任务。**

不以“长得像好 Skill”“结构完整”“读起来专业”为通过标准。  
如果不能证明某个 Skill 在真实任务中有效，就不能判定通过。

---

## Repository Map

```text
project-root/
├── AGENTS.md                          # 项目地图与 Agent 工作协议
├── STATUS.md                          # 当前项目状态，不在 AGENTS.md 中维护动态进度
├── rules/                             # 规则库：经验知识
│   ├── INDEX.md                       # 规则索引：R-001 ~ R-060，新增规则前必须查重
│   ├── L1-axioms.md                   # 公理级规律：始终参考
│   ├── L2-patterns.md                 # 强规律：相关时参考
│   └── L3-hypotheses.md               # 假说：低优先级，等待验证
├── analysis-cards/                    # 样本分析卡
│   ├── 01-frontend-design.md
│   ├── 02-skill-creator.md
│   └── ...
├── templates/                         # 模板
│   ├── analysis-card-template.md
│   ├── task-brief-template.md
│   ├── evaluation-report-template.md
│   ├── failure-report-template.md
│   ├── rule-backwrite-template.md
│   └── skill-package-template/
│       ├── SKILL.md
│       ├── references/
│       ├── scripts/
│       └── README.md
├── task-briefs/                       # 真实任务需求文档
│   └── [task-name].md
└── output/                            # 生成并通过验证的 Skill 包
    └── [skill-name]/
        ├── SKILL.md
        ├── README.md
        ├── references/
        ├── scripts/
        └── evaluations/
            └── evaluation-[task-name]-[round].md
```

---

## Current Status

当前项目进度不在本文件中维护。

Agent 需要了解当前状态时，读取：

```text
STATUS.md
```

如果 `STATUS.md` 不存在或明显过期，必须先提醒用户，而不是根据 AGENTS.md 中的旧状态继续推断。

---

## Core Workflow

```text
模块A：Ingest
→ 模块B：Distill
→ 模块C：Generate
→ 模块D：Evaluate & Iterate
```

| 模块 | 目标 | 主要产物 |
|---|---|---|
| A: Ingest | 收集并清洗优质样本 | 原始样本、样本说明 |
| B: Distill | 从样本中提炼规律 | analysis-cards、rules |
| C: Generate | 根据真实任务生成 Skill 包 | output/[skill-name]/ |
| D: Evaluate & Iterate | 用真实任务验证 Skill，并反写经验 | evaluation reports、rule updates |

---

# 模块C：生成 Skill 包的工作协议

当收到一个任务需求，即 Task Brief 时，按以下流程生成 Skill 包。

---

## Step 0: 检查 Task Brief 是否合格

在开始生成 Skill 前，必须先确认 Task Brief 是一个可验证的真实任务。

### 合格 Task Brief 最低结构

Task Brief 至少包含：

```markdown
# [Task Name]

## 背景
[为什么要做这个任务]

## 输入材料
[Agent 可以使用的资料、文件、上下文或约束]

## 目标产物
[最终要交付什么]

## Success Criteria
- [可检查标准 1]
- [可检查标准 2]
- [可检查标准 3]

## 不接受标准
- [什么情况算失败]
- [哪些偷懒做法不允许]

## 约束条件
- [时间、工具、格式、目录、风格、边界等限制]

## 人类决策点
- [哪些地方必须询问用户，不能自行决定]
```

### 真实任务定义

真实任务必须满足：

1. 来自 `task-briefs/` 中的任务文件，或由用户明确提供；
2. 有明确输入；
3. 有明确目标产物；
4. 有可检查的 Success Criteria；
5. 有至少一个“不接受标准”；
6. 不能由 Agent 为了方便验证而临时简化；
7. 不能用玩具示例冒充真实任务。

如果 Task Brief 缺少 Success Criteria 或不接受标准，必须先补齐或询问用户，不能自行降低标准后继续。

**检查点：** Task Brief 满足最低结构；如果不满足，先输出缺失项并请求补充。

---

## Step 1: 理解需求，不能跳过

回答三个问题：

1. 没有这个 Skill 时，Agent 的默认行为是什么？哪里不好？
2. 这个 Skill 要纠正的具体失败是什么？
3. 怎么验证 Skill 有效？给出一个具体任务场景。

要求：

- 回答必须具体，不能只写“提升质量”“提高效率”。
- 必须说明这个 Skill 纠正的是哪类默认失败行为。
- 必须说明验证方式如何对应 Success Criteria。

**检查点：** 三个问题都有具体答案。答不出则先和用户讨论。

---

## Step 2: 查询规则库

根据任务类型，从 `rules/` 目录中读取相关规则。

### 读取顺序

1. 始终读取 `rules/L1-axioms.md`；
2. 读取 `rules/INDEX.md`，确定可能相关的 L2 / L3 规则；
3. 精准读取 `rules/L2-patterns.md` 中与当前任务相关的条目；
4. 如任务与某个已分析样本高度相似，再读取对应的 `analysis-cards/`；
5. 只有在证据不足时，才读取 L3 假说。

不要一次性读取全部规则。  
标准模式是：

```text
索引优先 → 筛选 → 全文
```

参考 R-030。

### 必须记录

在 Skill 生成记录中写明：

```markdown
## 本次参考规则
- L1:
- L2:
- L3:
- analysis-cards:
- 未采用但考虑过的规则:
```

**检查点：** 明确记录本次参考了哪些规则，以及为什么采用或不采用。

---

## Step 3: 起草 Skill 包

按 `templates/skill-package-template/` 的目录结构生成 Skill 包。

### 输出目录

未通过验证前，Skill 可以暂存在工作区或草稿区。  
通过真实任务验证后，才能进入：

```text
output/[skill-name]/
```

推荐命名：

```text
output/[skill-name]/
├── SKILL.md
├── README.md
├── references/
├── scripts/
└── evaluations/
```

`[skill-name]` 使用 kebab-case，例如：

```text
pet-digital-character
landing-page-copy-review
api-error-diagnosis
```

---

## SKILL.md 必须包含的结构

```markdown
# [Skill 名称]

## description
[做什么 + 什么时候触发 + 用户可能怎么表达 + 不触发的近邻场景]

## 核心问题
- 目标问题：
- 没有此 Skill 时的默认失败行为：
- 本 Skill 如何纠正：

## 适用边界
- 适用：
- 不适用：
- Agent 不能假装能做的事：

## 工作流
Step 1: [可操作动词短语] → 检查点：[验证方式]
Step 2: [可操作动词短语] → 检查点：[验证方式]
...

## 失败处理
第1次失败 → [定位原因]
第2次失败 → [换本质不同方案，不允许只改参数]
第3次失败 → [输出失败报告，交接给人]

## 质检清单
☐ [检查项]
☐ [检查项]

## 常见错误（Common Mistakes）
| 错误做法 | 正确做法 |
|---------|---------|
| ... | ... |
```

---

## Skill 写作原则

- 不要堆 MUST，要解释 why。Agent 理解原因后才可以泛化。参考 R-006。
- 每步必须是可操作动词短语 + 检查点，不能是抽象描述。
- 如果涉及外部工具、API、文件系统或多步骤环境操作，必须加 Common Mistakes 段落。参考 R-050。
- `description` 要稍微 pushy：即使 Agent 觉得自己知道答案，也要先使用这个 Skill。参考 R-051。
- `description` 必须写清：
  - 什么时候触发；
  - 用户可能怎么表达；
  - 任务属于什么类型；
  - 什么近邻场景不触发。
- `SKILL.md` 控制在 500 行以内。长内容拆进 `references/` 目录。参考 R-005。
- 不能用更多指令掩盖 Agent 能力限制。能力限制必须写入“不适用”或“交给人”。参考 R-016。

**检查点：** `SKILL.md` 存在，结构完整，每步有检查点，边界清楚，失败处理可执行。

---

## Step 4: 跑任务验证，硬门禁，不能跳过

写完 Skill 后，必须立即用它执行一个真实任务。

流程：

1. 从 `task-briefs/` 中取对应任务描述；
2. 确认 Task Brief 满足最低结构；
3. 用刚写的 Skill 执行任务；
4. 产出真实任务结果；
5. 填写 Evaluation Report；
6. 给出明确 PASS / FAIL 判定。

不允许：

- 还没跑任务就说 Skill 写好了；
- 用模拟小例子替代真实任务；
- 自行降低 Success Criteria；
- 只根据“看起来不错”判定通过；
- 没有证据就判定 PASS。

---

## Evaluation Report 模板

每次验证必须生成评估报告。

保存路径：

```text
output/[skill-name]/evaluations/evaluation-[task-name]-round-[n].md
```

如果 Skill 尚未通过，可先放在草稿目录，但最终通过后必须随 Skill 一起归档。

模板如下：

```markdown
# Evaluation Report: [skill-name]

## 1. Task Brief
- Task source:
- Task name:
- Task file:
- Date:
- Evaluator:

## 2. Skill Version
- Skill path:
- Version or timestamp:
- Changed since last round:
  - [change 1]
  - [change 2]

## 3. Task Goal
[用自己的话复述任务目标]

## 4. Success Criteria

| Criteria | Evidence Required | Pass / Fail | Evidence |
|---|---|---|---|
| [标准 1] | [需要什么证据] | PASS / FAIL | [证据] |
| [标准 2] | [需要什么证据] | PASS / FAIL | [证据] |

## 5. Execution Trace

| Skill Step | Executed? | Evidence | Notes |
|---|---|---|---|
| Step 1 | Yes / No | [证据] | [说明] |
| Step 2 | Yes / No | [证据] | [说明] |

## 6. Output
[粘贴或链接到真实任务产物]

## 7. Unexpected Failures
- [失败或异常 1]
- [失败或异常 2]

## 8. Boundary Check
- 是否出现 Skill 声称能做但实际做不到的事？
- 是否有应交给用户或其他工具的决策点？
- 是否发生静默降级？

## 9. Verdict

最终判定：PASS / FAIL

理由：

- [理由 1]
- [理由 2]

## 10. If FAIL: Failure Analysis

失败主要属于：

- [ ] Skill 指令不清楚
- [ ] 检查点缺失
- [ ] 触发条件错误
- [ ] 边界没划清
- [ ] Task Brief 不清楚
- [ ] Agent 能力限制
- [ ] 外部工具或环境限制
- [ ] 其他：

具体原因：

[详细说明]

## 11. Next Action

- [ ] Accept and archive to output/
- [ ] Iterate Skill and rerun evaluation
- [ ] Backwrite rule
- [ ] Ask human for decision
- [ ] Stop after 3 failed rounds and produce Failure Report
```

**检查点：** 任务跑完，有 Evaluation Report，有明确 PASS / FAIL，有证据支撑。

---

## 工程验收协议（桌宠 / Electron / WebGL / 动效相关）

当任务不只是“写文档/写 Skill”，而是涉及真实运行态（例如 Electron 桌宠壳、Live2D、WebGL、透明窗口、穿透、快捷键等），必须额外满足以下验收门禁。否则不得宣称“已验收/已验证”。

### 1) 验收证据门禁（PASS 需要的最小证据）

必须至少同时满足：

- 运行态证据：桌宠壳启动后，出现可见内容（图片或 Live2D 模型）并可持续 10 秒不崩溃
- 交互证据：至少一个交互可用（重载/关闭/穿透切换/拖拽/模型点击）
- 日志证据：`desktop-pet-shell/.user-data/pet-shell.log` 中无 “preload load failed / module not found / unsafe-eval / runtime missing” 等致命错误

若任何一条缺失，只能描述为“实现了代码路径/完成了接线”，不得描述为“已验收通过”。

### 2) 运行态前置清理（避免假阳性）

每次验收前必须执行：

- 清理旧进程：确保没有残留 electron/桌宠壳旧进程（旧进程会导致你看到的不是新版本）
- 清理旧状态：确保当前 `desktop-pet-shell/config.json` 与目标模式一致
- 清理旧日志噪声：以“最新启动时间段”的日志为准，不得用历史错误混淆本次结论

### 3) Electron / Live2D 特有风险清单（必须逐项确认）

- Preload 安全边界：`preload.js` 不得依赖 Node 内建模块（fs/path）直接读文件；必须走 IPC
- CSP 兼容：不得引入会触发 `unsafe-eval` 的构建产物；如必须使用，需有明确的 CSP 策略与证据
- 版本锁定：Pixi / Live2D 插件必须固定版本与固定 bundle（例如 cubism4-only），不得“凭感觉换版本”
- 资源路径：Live2D `model3.json` 必须是可读的相对路径，且与落盘目录结构一致
- 交互冲突：避免 `-webkit-app-region: drag` 抢占所有点击导致模型不可交互；拖拽必须与交互可共存

### 4) 失败后回写（自进化要求）

若用户在验收阶段遇到“我说通过但实际失败”的情况，必须执行：

- 失败归因：写清“我当时为什么会误判通过”（缺少哪条证据、跳过了哪个门禁）
- 流程修订：将新门禁写回本文件（本段）或 rules/，确保下次同类任务不会复发

### 5) 小优化直接加，先加再汇报（用户授权）

凡是满足以下全部条件的"体验小优化"，**无需先征求用户确认**：

- 改动只触及现有文件，不引入新的依赖 / 服务 / 工作流；
- 改动目的是让"按钮反馈、状态提示、错误兜底、键位保护"等更直观；
- 改动可以用 TDD 钉住（红→绿）；
- 不消耗用户的 API 额度；
- 不改变"用户必须显式决策"的语义。

Agent 应该：

1. 直接写测试、写实现、跑绿；
2. 在下一次回复里简短列出"已加了什么、为什么"；
3. 不要因为是"小优化"就跳过 TDD 或跳过 typecheck。

凡是超出以上边界的（例如：换底层库、接入付费 API、改变视觉风格主基调、删文件等），仍必须先与用户确认。

---

## Step 5: 迭代或交付

### 如果 PASS

1. 将 Skill 包放入：

```text
output/[skill-name]/
```

2. 确认包含：

```text
output/[skill-name]/
├── SKILL.md
├── README.md
├── references/
├── scripts/
└── evaluations/
    └── evaluation-[task-name]-round-[n].md
```

3. 如果发现了新的可复用规律，执行规则反写流程。
4. 更新 `STATUS.md`，而不是更新 AGENTS.md。

---

### 如果 FAIL

执行以下流程：

1. 定位失败原因：
   - Skill 指令不清楚？
   - 检查点缺失？
   - 触发条件错误？
   - 边界没划好？
   - Task Brief 不清楚？
   - Agent 能力限制？
   - 外部环境限制？

2. 区分 Skill 问题和 Agent 问题：
   - Skill 问题 → 修改 Skill；
   - Agent 能力限制 → 写进“不适用”，不要用更多指令假装能解决；
   - Task Brief 问题 → 补齐任务要求或询问用户；
   - 外部工具问题 → 记录依赖，不允许静默降级。

3. 修改 Skill。

4. 重新跑任务，回到 Step 4。

5. 最多迭代 3 轮。

6. 第 3 轮后仍 FAIL，必须输出 Failure Report，并标明：
   - 失败的具体原因；
   - 尝试过的方案；
   - 每轮修改了什么；
   - 为什么仍未通过；
   - 需要人介入的决策点。

### Failure Report 模板

```markdown
# Failure Report: [skill-name]

## Task
- Task name:
- Task file:
- Date:

## Skill
- Skill path:
- Versions attempted:

## Summary
[一句话说明为什么失败]

## Attempts

| Round | Main Change | Result | Reason for Failure |
|---|---|---|---|
| 1 | [修改点] | FAIL | [原因] |
| 2 | [修改点] | FAIL | [原因] |
| 3 | [修改点] | FAIL | [原因] |

## Root Cause

失败主要属于：

- [ ] Skill 设计问题
- [ ] Task Brief 不完整
- [ ] Agent 能力限制
- [ ] 工具或环境限制
- [ ] 规则库误导
- [ ] 其他：

详细说明：

[具体分析]

## Human Decision Needed

需要人类决定：

- [决策点 1]
- [决策点 2]

## Rule Backwrite Needed

- [ ] 是
- [ ] 否

如果是，建议写入：

- L2:
- L3:
- INDEX:
```

---

# 模块D：规则反写协议

失败点必须反写进规则库。  
这是系统进化的核心机制。

但反写不能随意堆经验，必须格式化、可追踪、可升级、可冲突检查。

---

## 什么时候反写规则

以下情况必须考虑反写：

1. Skill 失败暴露了一个可复用问题；
2. 某个检查点明显防止了错误；
3. 某条现有规则不够清楚；
4. 某条现有规则在当前任务中误导了 Agent；
5. 发现了新的触发条件、边界条件或失败模式；
6. 同一类错误第二次出现。

以下情况不应反写为规则：

1. 只对单一任务有效的临时偏好；
2. 用户个人风格要求，除非项目长期适用；
3. 没有证据支持的直觉；
4. 与 L1 公理冲突的经验；
5. Agent 为掩盖失败而写的事后解释。

---

## 规则分级

| 层级 | 含义 | 写入条件 |
|---|---|---|
| L1 | 公理级规律 | 多样本、多任务反复验证，几乎始终成立 |
| L2 | 强规律 | 被多个任务验证，对一类任务稳定有效 |
| L3 | 假说 | 单次或少量任务中观察到，有待验证 |

默认规则：

> 单次失败经验默认写入 L3，不得直接升级为 L2。

升级标准：

- 同一规律被至少 3 个不同任务验证；
- 没有与 L1 冲突；
- 与现有 L2 不重复；
- 有明确触发条件和不适用边界。

---

## Rule Backwrite 模板

新增或修改规则时，使用以下模板：

```markdown
# Rule Backwrite

## Rule ID
R-[待分配或已有编号]

## Proposed Level
- [ ] L2
- [ ] L3

## Source
- Task:
- Skill:
- Evaluation Report:
- Date:

## Trigger Context
[什么场景下这条规则适用]

## Observed Failure or Success
[观察到的失败或成功现象]

## Better Behavior
[更好的 Agent 行为应该是什么]

## Rule Statement
[规则正文：尽量短、明确、可执行]

## Why
[为什么这条规则成立]

## Evidence
- [证据 1]
- [证据 2]

## Boundary
不适用于：

- [边界 1]
- [边界 2]

## Related Rules
- R-[已有规则]
- R-[已有规则]

## Conflict Check
- 是否与 L1 冲突：Yes / No
- 是否与现有 L2 重复：Yes / No
- 是否替代旧规则：Yes / No

## Decision
- [ ] Add to L3
- [ ] Add to L2
- [ ] Update existing rule
- [ ] Do not add

## Notes
[补充说明]
```

---

## 规则编号协议

新增规则前必须读取：

```text
rules/INDEX.md
```

检查：

1. 是否已有相同或近似规则；
2. 下一个可用编号是什么；
3. 是否需要更新旧规则而不是新增规则；
4. 是否存在冲突或替代关系。

规则编号要求：

- 使用 `R-001` 格式；
- 编号一旦发布，不得复用；
- 废弃规则不得删除，标记为 `Deprecated`；
- 替代规则必须写明 `Replaced by R-xxx`；
- 修改已有规则时，必须保留原意变化说明。

---

# 规则库使用协议

## 何时读取

| 场景 | 读什么 |
|---|---|
| 生成任何 Skill 时 | 始终读 `L1-axioms.md` |
| 任务涉及特定领域时 | 读 L2 中相关条目 |
| 任务和某样本高度相似时 | 读对应 analysis-card |
| 评估 Skill 质量时 | 读 L1 + 快速评估清单 |
| 反写规则时 | 读 `INDEX.md` + 相关 L2 / L3 |

---

## Skill 快速评估清单

当需要判断一个 Skill 好不好时：

| 维度 | 问题 | 不及格信号 |
|---|---|---|
| 触发 | description 说清了何时触发/不触发？ | “需要时使用”、无触发词 |
| 边界 | 有不适用声明？ | 隐含“什么都能做” |
| 流程 | 每步有检查点？ | 步骤是抽象描述 |
| 失败 | 有失败处理？ | 只有正常路径 |
| 验证 | 输出能被客观判断？ | 只能主观评价 |
| Token | 有信息读取控制？ | 一次性读全量 |
| 人机分工 | 诚实标明了做不到的事？ | 被要求超出能力的事 |
| 证据 | PASS 有证据吗？ | “看起来不错” |

---

## Skill 质量等级

真实任务 PASS 是硬门槛。  
在 PASS 之后，再评质量等级。

| 等级 | 标准 |
|---|---|
| A | 真实任务通过；触发准确；边界清晰；检查点有效；有泛化价值 |
| B | 真实任务通过；主要结构可用；但泛化、边界或失败处理仍有改进空间 |
| C | 勉强通过；高度依赖当前任务；不建议直接复用 |
| F | 未通过真实任务验证 |

注意：

> 没有 Evaluation Report 的 Skill 不能评为 A 或 B。

---

# 文件操作边界

## 允许修改

Agent 可以在任务需要时创建或修改：

```text
output/[skill-name]/
templates/
task-briefs/
rules/L3-hypotheses.md
rules/INDEX.md
STATUS.md
```

但修改规则库前必须执行规则反写协议。

---

## 谨慎修改

以下文件可以修改，但必须说明原因：

```text
rules/L2-patterns.md
templates/skill-package-template/
templates/evaluation-report-template.md
templates/rule-backwrite-template.md
```

修改前必须确认：

1. 修改是否影响已有 Skill；
2. 是否与 L1 公理冲突；
3. 是否需要更新 `rules/INDEX.md`；
4. 是否需要在 `STATUS.md` 记录。

---

## 默认不得修改

以下内容默认不得修改，除非用户明确要求：

```text
analysis-cards/
rules/L1-axioms.md
历史 evaluation reports
历史 failure reports
已通过验证并归档的 output/[skill-name]/
```

如果确实需要修改，必须先说明：

- 为什么需要修改；
- 会影响哪些产物；
- 是否需要保留旧版本；
- 如何验证修改没有破坏已有结论。

---

## 禁止行为

Agent 不得：

1. 删除历史失败报告；
2. 静默覆盖已通过验证的 Skill；
3. 为了让评估通过而降低 Success Criteria；
4. 用玩具任务冒充真实任务；
5. 没有读取 `rules/INDEX.md` 就新增规则编号；
6. 把单次经验直接写成 L1 或 L2；
7. 把 Agent 能力限制包装成“只要指令更详细就能解决”；
8. 在没有证据时判定 PASS；
9. 一次性读取全部规则库来替代筛选；
10. 修改 `AGENTS.md` 中的动态状态。动态状态写入 `STATUS.md`。

---

# L1 公理级规律速查

以下规律在样本中被反复验证，是所有设计决策的底层判断依据。

## L1-A：明确触发条件

好 Skill 说清三件事：

1. 用户说了什么时触发；
2. 任务属于什么类型时触发；
3. 什么情况绝不触发。

Agent 有 undertrigger 倾向。触发条件模糊时，它宁可不触发。

---

## L1-B：限制自己的边界

越成熟的 Skill 越不假装万能。

必须说清：

- 什么不适用；
- 什么交给人；
- 什么交给其他 Skill；
- 什么需要外部工具；
- 什么无法仅靠文字指令保证。

---

## L1-C：把判断标准数字化

不说“保持简洁”，而说：

> 净涨幅超过 30 行是红灯。

不说“写得像真人”，而说：

> 检查温度感、独特性、姿态、心流。

判断标准越可检查，Agent 越不容易自我感觉良好。

---

## L1-D：设计信息读取顺序

不把知识堆给 Agent。

标准模式：

```text
索引优先 → 筛选 → 全文
```

这可以减少 Token 浪费、注意力污染和误套规则。

---

## L1-E：内置质检清单

Agent 默认行为是“做完就交差”。

没有质检清单，表面合规会被当成完成。  
好的 Skill 必须把检查行为写进工作流。

---

## L1-F：不能证明通过 = 不通过

如果不能证明某个要求已被满足，就判定未通过。

这条规则优先级很高，用于防止 Agent 对自己输出评价过高。

---

# 常用指令

| 用户指令 | Agent 行为 |
|---|---|
| “用 [task-brief] 生成 Skill” | 启动模块C |
| “评估这个 Skill” | 用快速评估清单 + Evaluation Report 审查 |
| “跑任务验证” | 启动模块D |
| “把失败点写进规则库” | 执行 Rule Backwrite 协议 |
| “新增分析卡” | 拆解新样本，生成 analysis-card |
| “更新项目状态” | 修改 `STATUS.md`，不改 AGENTS.md |
| “生成失败报告” | 使用 Failure Report 模板 |

---

# 重要约束

1. 第一阶段不追求规模，优先追求闭环可跑通。
2. 以“任务能跑通”为最高标准，文风和排版是次要辅助。
3. 优先从已有规则库出发，不要每次重新发明。参考 R-037。
4. 失败时不允许只改参数重试，必须换本质不同方案。参考 R-035。
5. 不允许静默降级。如果某步做不到，必须告知用户为什么。参考 R-049。
6. 不能证明通过，就不能判定通过。
7. 动态项目状态进入 `STATUS.md`，不要写死在 `AGENTS.md`。
8. 规则库进化必须可追踪、可审计、可回滚。
