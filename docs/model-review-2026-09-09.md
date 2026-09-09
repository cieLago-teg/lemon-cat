# 模型与提示词审阅（2026-09-09）

## 结论与本次范围

当前先优化信息传递、提示词冲突和模型参数，尚无证据支持直接微调。默认仍使用 Qwen3-VL Plus → Qwen Image Edit Plus → Wan 2.6 Flash。Qwen Image 3.0 和 Qwen3.7 Flash 已用真实图片调用成功；其他候选按官方协议准备，不能视为已经通过真实验收。

本次不恢复 VL 身份审核。主人仍是结果验收者；故事不会参与图像生成。代码与配置不包含用户照片、故事或密钥。

## 实际生效的配置

| 阶段 | 环境变量 | 本机实际使用 |
| --- | --- | --- |
| 特征提取 | `BAILIAN_VL_MODEL` | `qwen3-vl-plus` |
| 原图转绘 | `BAILIAN_PET_IMAGE_MODEL` | 未显式设置，采用 `qwen-image-edit-plus-2025-12-15` |
| 图生视频 | `DASHSCOPE_VIDEO_MODEL` | `wan2.6-i2v-flash` |

本机 `.env.local` 中旧的 `BAILIAN_IMAGE_MODEL=qwen-image-2.0` 不控制宠物转绘，容易造成“以为在用 2.0，实际却在用 Plus”的误解。新的检查命令显示实际解析值，并提示旧变量被忽略：

```powershell
npm run models:inspect
```

启动 worker 也会记录实际模型和提示词版本 `pet-appearance-2026-09-09`。图像任务结果记录生成模型及提示词版本，日志记录请求长度、耗时、供应商请求 ID（如果返回），不记录原图和完整用户输入。

## 同模型优化

1. **提取事实更克制。** 不确定的品种、眼色和不可见部位省略；用画面左右避免解剖左右混淆；不把瞬间表情推断成性格。删除会教模型把两只白前爪推断成“四蹄踏雪”的旧示例。
2. **完整保留标签。** 去掉按 150 字硬截断，按短语分隔和去重；模型输出长度不足时明确报错。原始小数点不会误拆标签。
3. **主人修正优先。** 原图、主人明确修正、主人保留标签、氛围、画风分段组织。个性仅影响神态，故事不进入提示词。
4. **减少画风与身份冲突。** 马卡龙色不再覆盖真实毛色；有短尾/无尾/缺肢时不强行补齐；像素风由强制 16×16、4–8 色调整为约 32×32 视觉密度、8–12 色，以保留花纹。这是生成指令，并非保证输出严格像素网格的后处理算法。
5. **编辑请求关闭自动扩写。** `prompt_extend=false`，避免已编排好的约束再次被改写。主体原图始终进入编辑接口。
6. **视频减少运动冲突。** 呼吸为主动作，眨眼为辅助；脚掌保持原位；去掉“所有部位必须动”、用提示词强定 fps 等要求，补上水墨与和纸风格保持约束。时长显式为 5 秒，分辨率 720P；Flash 保持无声。用户明确填写的自定义动画提示词仍原样使用。
7. **请求更易排障。** VL 总超时覆盖响应体读取；JSON 解析错误保留 cause；新增业务空间域名的同地域视频端点推导，错误配置明确报错。

自动扩写及编辑参数依据：[图像编辑 API](https://help.aliyun.com/zh/model-studio/qwen-image-edit-api)。详细提示词适合关闭扩写的说明：[图像生成指南](https://help.aliyun.com/zh/model-studio/text-to-image)。

## 真实对比结果

原图是此前用户提供的、有人抱着银灰长毛猫的图片。使用固定人工特征标签、相同 seed=42、四种风格，每组合各生成一次。旧版从 `c9186de` 加载原提示词和原请求实现，仅补入相同 seed；新版同时改变提示词和参数。因此这是整体方案对比，不是单因素实验。

| 组合 | 成功返回 | 平均生成及下载耗时 |
| --- | --- | --- |
| 旧提示词 + Edit Plus | 4/4 | 7.97 秒 |
| 新提示词 + Edit Plus | 4/4 | 8.54 秒 |
| 新提示词 + Image 3.0 | 4/4 | 13.23 秒 |

观察：新 Plus 的画风区分仍明显，毛色保持银灰且构图较统一；不能据此宣称所有风格的身份保真都优于旧版。Image 3.0 的这个样本更偏写实，四种画风差异不足，尤其像素与和纸效果不如目标明确。因此保持 Plus 默认，Image 3.0 作为可选候选。

两次独立特征提取均成功：Qwen3-VL Plus 约 5.47 秒；Qwen3.7 Flash 2026-07-15 约 6.22 秒。Flash 这个样本未推断眼色，但有重复的毛长描述；现用 VL 给出了需要主人复核的眼色。不能把单次响应当作整体准确率或延迟基准。提取结果没有自动改变本轮用于生图的固定标签。

证据（本地，被 Git 忽略）：

- `data/evaluations/model-lab-be35800d-f5d9-480a-9fc9-e0f2e83b8ee9/index.html`：按画风并排对比，双击可看，无需登录。
- 同目录 `report.json`：模型、提示词、seed、源图哈希、耗时、成功/错误及原始标签。
- `output/playwright/model-comparison.png`：实际浏览器截图。

这次未调用付费视频模型或训练接口。图片估算合计约 2.40 元，另有两次 VL token 费用；实际扣费以供应商账单与免费额度为准。

## 新模型选择与接入状态

| 候选 | 项目价值判断 | 当前状态 |
| --- | --- | --- |
| `qwen-image-3.0` | 新一代生成编辑统一模型；值得试，但本轮转绘不够风格化 | 四种风格真实调用成功；未设默认 |
| `qwen-image-3.0-pro` | 可尝试更强指令执行，是否更适合本项目待验收 | 参数与请求测试通过；未做付费调用 |
| `qwen-image-2.0-2026-03-03` | 同价位备选，支持图像编辑；未来有托管 LoRA 路径 | 支持列表与参数准备完成；本轮未实测 |
| `qwen-image-edit-max-2026-01-16` | 官方定位强调角色一致性，可作为难样本候选 | 参数准备完成；本轮未实测 |
| `qwen3.7-flash-2026-07-15` | 特征提取任务的低成本候选，支持视觉、非思考模式 | 真实调用成功；未设默认 |
| `qwen3.8-flash` | 比 3.7 更新；本任务暂缺升级收益证据 | 非思考请求准备完成；本轮未实测 |
| `wan2.7-i2v-2026-04-25` | 支持首尾帧，可减少循环首尾差异 | 已适配 `media` 首尾帧；仅本地协议测试 |

模型能力来源：[Image 3.0](https://help.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference)、[视觉模型列表](https://help.aliyun.com/zh/model-studio/vision-model/)、[非思考参数](https://help.aliyun.com/en/model-studio/qwen-api-via-openai-chat-completions)、[Wan 2.7](https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference)。业务空间、地域和账号权限仍决定是否可调用；优先使用有官方固定日期 ID 的版本，3.0 当前列出的名称仍为别名。

北京地域价格快照：Edit Plus、Image 2.0 为 0.20 元/张；Edit Max、Image 2.0 Pro 为 0.50 元/张。Image 3.0 在本项目单参考图、1k 输出条件下为输入 0.02 + 输出 0.18 = 0.20 元；3.0 Pro 为 0.02 + 0.25 = 0.27 元。Wan 2.6 Flash 720P 无声 5 秒约 0.75 元，Wan 2.7 有声 5 秒约 3 元。均不含免费额度抵扣、存储等费用。[官方价格](https://help.aliyun.com/zh/model-studio/model-pricing)

Wan 2.7 的新增代码会将**同一张用户所选图**同时作为首尾帧；私有素材可直接用 Base64 发送。它不使用旧协议的 `img_url`，也不传未确认支持的 `audio=false`。这有助于约束端点，却不能保证中间运动或循环拼接完全无缝。Wan 2.6 Flash 仍沿用现有供应商可访问存储路径，不应把 2.7 的 Base64 能力误认为当前默认流程已解决外部存储部署。

## 以后自己做对比

在项目目录执行。默认仅生成提示词预览报告，不调用模型：

```powershell
npm run models:inspect -- --image "D:\你的图片\pet.png" --models "qwen-image-edit-plus-2025-12-15,qwen-image-3.0" --features "银灰长毛，胸前白毛" --details "尾巴很短"
```

确认预览后，加 `--run` 才真实生成。`--styles 2` 只测贴纸风，可先省成本；`--vision-models "qwen3-vl-plus,qwen3.7-flash-2026-07-15"` 可同时比较特征提取。每项只请求一次，不自动重试或替换模型。单次上限为 12 张图、3 次特征提取；这是数量上限，不是供应商费用上限。

例：只测新模型的一种风格：

```powershell
npm run models:inspect -- --image "D:\你的图片\pet.png" --models qwen-image-3.0-pro --styles 2 --run
```

验证满意后，在 `.env.local` 修改 `BAILIAN_PET_IMAGE_MODEL` 或 `BAILIAN_VL_MODEL`，重启 `npm run dev`；运行 `npm run models:inspect` 确认生效值。如果 shell 或 `.env.1a.local` 中也设置了同名变量，注意现有环境加载优先级，最终以检查输出为准。恢复表格中的原默认值并重启即可回退。CLI 测试中的 `--models` 只影响本次评估，不修改应用默认配置。

## 微调是否必要、怎么做

**目前不建议立即训练。** 当前已知问题多数出在指令冲突、输出处理与风格选择，且缺少跨宠物、主人确认的稳定评估集。先保留用户的删改标签、采用结果、重试原因，获得明确的失败模式；用户照片和故事不能因为上传到应用就自动当作训练授权。

若后续需要独有且稳定的品牌画风，我优先考虑**共享风格 LoRA**：用多只宠物的“原图 → 主人认可的目标画风”配对，学习转换规律。每只宠物各训练一个 LoRA 不适合当前单图、低门槛、即时生成的目标。VL 的特征提取只在大量已标注样本上出现稳定错误时才考虑单独微调。

可执行的第一轮实验设计（工程建议，不是保证有效的数据量）：

1. 先选一种商业价值最高的画风，收集至少 30–50 只不同宠物的授权配对样本作为探索集；覆盖深浅毛色、长短毛、独特斑纹、短尾及有遮挡原图。目标图必须人工筛选。
2. 按宠物身份划分训练、验证、最终测试组，约 70%/15%/15%；同一宠物的不同照片和生成结果不得跨组，以免虚高评估。
3. 对比三组：当前默认、改进提示词、新增 LoRA。使用相同参考图和风格意图；主人盲选、特征修正率、风格达标率、每张被接受图片的成本作为指标，不用 VL 硬裁判。
4. 可优先使用百炼北京地域 `qwen-image-2.0` 的托管 `efficient_sft`，选择图生图 `generation_type=i2i`；需要输入图、目标图和转换指令。具体数据字段与参数按当前创建任务 API 核对，先做离线数据校验与费用估算。
5. 我可以编写数据清洗/分组/打包脚本、创建与轮询训练任务、保存模型 ID、实现候选调用与回退，并执行评估。真正开训需要已经确认的图片授权、训练账号权限、预算上限和目标画风。本次没有上传训练集、租用 GPU 或启动训练。

官方已提供 Qwen Image 2.0 托管 LoRA 路径；训练费受图片数、分辨率、epoch 和调度 GPU 系数影响，不能简单按“几张照片”猜成本。开源编辑模型也可通过 PAI ArtLab 微调，但训练产物必须配套对应底模与部署方式，不能直接挂到任意商业模型名上。[图像微调指南](https://help.aliyun.com/zh/model-studio/wan-image-generation-finetune-guide)、[创建任务 API](https://help.aliyun.com/zh/model-studio/image-generation-create-fine-tuning-job-api)、[训练计费](https://help.aliyun.com/zh/model-studio/model-training-and-deployment-billing)、[PAI ArtLab](https://help.aliyun.com/zh/pai/pai-artlab-modelscope-model-training)

## 验证命令

```powershell
npm run check
npm run check:service
npm run check:http
npm run worker:build
npm run lint
```

新回归测试实际执行请求构建与 worker，检查原图、主人修正、故事排除、四风格完整返回、模型参数及新旧视频协议。实图报告用于效果复核；协议测试不代替真实视频与后续桌宠效果验收。
