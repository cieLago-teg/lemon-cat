# Live2D UV 保真 GATE 测试脚本

> **重要说明**：亲爱的 cieLago，这个目录里的脚本是 **Task 0 HARD GATE** 的测试工具。
> 因为沙箱环境无法真正调 DashScope 拿回 AI 编辑后的图片，**GATE 的实际跑通需要在你的本地 Windows 上**。
> 我把全部代码都写好了，你只需要 `node spike/live2d-uv-gate/run-gate.js` 一行就能跑。

---

## 跑 GATE 之前你需要的

- ✅ Node.js 18+
- ✅ 你的 `.env.local` 里配置了 `DASHSCOPE_API_KEY`（项目其他地方用的同一个 key）
- ✅ `npm install` 已经跑过（这个脚本只用到 `node:fs` / `node:path` / `undici`，undici 项目已经依赖）

## 一行运行

```bash
cd d:\TRAE\柠檬树苗
node spike/live2d-uv-gate/run-gate.js
```

跑完后：
- 控制台会打印每条 AI 路径的 `GATE PASS / GATE FAIL` 结论
- `spike/live2d-uv-gate/out/` 目录里会保存：
  - `baseline/texture_00.png`（基线，shizuku 原纹理，未改）
  - `ai_outputs/<strategy>_<timestamp>.png`（AI 返回的"废图"，如果失败也保存）
  - `diffs/<strategy>_diff.png`（基线 vs AI 的逐像素差异热图，红色=差异大，蓝色=基本一致）
  - `gate-report.json`（机器可读的 GATE 结论）
  - `gate-report.md`（人类可读的 GATE 报告，附你的裁决建议）

## GATE 判定标准（写死在 `lib/gate-judge.js`）

- **像素尺寸严格一致**：width × height 必须等于原纹理，**任何 resize / pad 算失败**
- **几何稳定性**：取 9 个采样点（左上/中上/右上/左中/正中/右中/左下/中下/右下），看每个采样点周围 5×5 区域内"非透明像素"是否还在原位。任一采样点偏移 > 4 像素即失败
- **轮廓稳定性**：用 Sobel 算子抽 alpha 通道的边缘，AI 输出的边缘与基线边缘的 IoU 必须 ≥ 0.85
- **颜色变化率**：AI 输出与基线的 RGB 平均色差应在 5~80 之间。色差 < 5 算"AI 没真改色"（等于没换皮）；色差 > 80 算"AI 重画了整张图"

> 任意 1 个采样点偏移 > 4px **或** 边缘 IoU < 0.85 **或** 颜色变化率 < 5 **或** > 80 → **GATE FAIL**
> 否则 → **GATE PASS**

## 内置 3 条 AI 路径

| 路径 | 模型 | 思路 |
|------|------|------|
| `qwen_image_edit` | qwen-image-edit（百炼） | 真正的图像编辑，强约束 prompt |
| `qwen_image_t2i` | qwen-image-2.0-pro | 文生图近似：让 AI 用 prompt 描述原图并"重画同样布局"——**最差 fallback**，但最稳 |
| `wan2_6_first_frame` | wan2.6-i2v-flash | 图生视频取首帧，prompt 强约束"只改色不动布局" |

**任意 1 条通过 GATE，整条 POC 就能继续**。如果 3 条全失败 → 立即停，回到亲爱的 cieLago 报告"AI 换皮路线不可行，需要换技术路线（自训 LoRA / 单图 sprite atlas / 纯帧动画）"。

## 失败保存

每条 AI 路径的"废图"（哪怕 GATE 失败）都保存在 `ai_outputs/`，方便你后续人工分析。
