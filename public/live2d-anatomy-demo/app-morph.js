// Natori → Cat Morph Demo · 主逻辑
// 加载改造后的 Natori 模型（cdi3 21 参数 + model3 新增 HitAreas/Groups/Motions）
// + 提供 17 个参数滑块 + 4 个猫化动作按钮 + 8 个原 Natori 动效按钮

const MODEL_PATH = "/models/pet-cat-morph/Natori.model3.json";
const TEXTURE_PATH = "/models/pet-cat-morph/Natori.2048/texture_00.png";
const CAT_EARS_PATH = "/models/pet-cat-morph/textures/cat_ears.png";
const CAT_TAIL_PATH = "/models/pet-cat-morph/textures/cat_tail.png";

// 🆕 多模型切换支持
const MODEL_PRESETS = {
  natori: {
    path: "/models/pet-cat-morph/Natori.model3.json",
    label: "Natori 改造中",
    badge: "👤 人形",
  },
  mao: {
    path: "/models/l2d-samples-mirror/Mao/Mao.model3.json",
    label: "Mao 4 臂女巫",
    badge: "🧙 官方",
  },
  wanko: {
    path: "/models/l2d-samples-mirror/Wanko/Wanko.model3.json",
    label: "Wanko",
    badge: "🐕 官方",
  },
};
let currentModelKey = "natori";

// 让 PIXI 知道 Live2D 后端
if (PIXI.live2d && PIXI.live2d.Live2DModel) {
  PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
}

// 17 个核心滑块（精简后：头3+体3+嘴1+臂6+耳2+尾2 = 17）
// 注意：moc3 仍是原版二进制，参数名是老的 96 个 ID（新 cdi3 里的精简名要兼容）
const KEY_PARAMS = [
  "ParamAngleX", "ParamAngleY", "ParamAngleZ",
  "ParamBodyAngleX", "ParamBodyAngleY", "ParamBodyAngleZ",
  "ParamMouthOpenY",
  "ParamArmAL01", "ParamArmAL02", "ParamArmAL03",
  "ParamArmAR01", "ParamArmAR02", "ParamArmAR03",
  "ParamCatEarLRot", "ParamCatEarRRot",
  "ParamTailSwing", "ParamTailCurl",
];
// 别名表：精简 cdi3 名 → 原 moc3 老 ID（运行时驱动用老 ID 才能动）
const PARAM_ALIASES = {
  "ParamCatEarLRot": null,   // moc3 无此参数，等 Cubism Editor
  "ParamCatEarRRot": null,
  "ParamTailSwing": null,
  "ParamTailCurl": null,
  "ParamMouthOpenY": "ParamMouthOpenY",  // 一致
};

// 表情名字 → 中文翻译（保留原 Natori 表情）
const EXPRESSION_NAMES_CN = {
  "Normal": "正常",
  "Smile": "微笑",
  "Angry": "生气",
  "Sad": "悲伤",
  "Surprised": "惊讶",
  "Blushing": "脸红",
};

let app = null;
let model = null;
let params = [];
let fpsFrames = 0;
let fpsLast = performance.now();

window.addEventListener("DOMContentLoaded", main);

async function main() {
  // 绑定模型切换按钮
  document.querySelectorAll("button[data-switch]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.switch;
      currentModelKey = key;
      // 销毁旧模型
      if (model) {
        app.stage.removeChild(model);
        try { model.destroy(); } catch (e) { /* ignore */ }
      }
      await loadModel(key);
    });
  });

  await loadModel(currentModelKey);
}

async function loadModel(key) {
  const preset = MODEL_PRESETS[key] || MODEL_PRESETS.natori;

  // 第一次创建 PIXI Application
  if (!app) {
    setStatus("⏳ 加载 PIXI 应用…");
    try {
      app = new PIXI.Application({
        view: createCanvas(),
        autoStart: true,
        backgroundAlpha: 0,
        width: 600,
        height: 750,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
    } catch (e) {
      setStatus("❌ PIXI 初始化失败：" + e.message);
      return;
    }
    startFps();

    // 一次性贴图加载（Natori 改造模型用）
    const texImg = document.getElementById("texture-only-img");
    if (texImg) {
      texImg.src = TEXTURE_PATH;
      texImg.onerror = () => { texImg.alt = "❌ 贴图加载失败：" + TEXTURE_PATH; };
    }
    const earsImg = document.getElementById("cat-ears-img");
    if (earsImg) {
      earsImg.src = CAT_EARS_PATH;
      earsImg.onerror = () => { earsImg.alt = "❌ 猫耳贴图缺失"; };
    }
    const tailImg = document.getElementById("cat-tail-img");
    if (tailImg) {
      tailImg.src = CAT_TAIL_PATH;
      tailImg.onerror = () => { tailImg.alt = "❌ 猫尾贴图缺失"; };
    }
  }

  setStatus("⏳ 加载 " + preset.label + "（首次需要几秒）…");
  try {
    model = await PIXI.live2d.Live2DModel.from(preset.path, { autoInteract: true });
  } catch (e) {
    setStatus("❌ 模型加载失败：" + e.message + "\n路径：" + preset.path);
    return;
  }

  app.stage.addChild(model);

  // 暴露到 window 供 evaluate_script 探针使用
  window.model = model;
  window.__dumpMeshOnce = function () {
    const core = model.internalModel.coreModel;
    const drawables = core.drawables || [];
    const parts = core.parts || [];
    console.log("===[DRAWABLES] count=" + drawables.length + "===");
    drawables.forEach((d, i) => {
      console.log("draw[" + i + "] id=" + d.id + " name=" + d.name +
        " vis=" + d.isVisible + " mask=" + d.isMasked +
        " opacity=" + d.opacity + " verts=" + d.vertexCount);
    });
    console.log("===[PARTS] count=" + parts.length + "===");
    parts.forEach((p, i) => {
      console.log("part[" + i + "] id=" + p.id + " opacity=" + p.opacity);
    });
    return { drawableCount: drawables.length, partCount: parts.length };
  };
  console.log("[Probe] window.__dumpMeshOnce() ready — call it from console");

  // 居中 + 缩放
  model.anchor.set(0.5, 0.5);
  model.x = app.screen.width / 2;
  model.y = app.screen.height / 2;
  const targetH = Math.min(app.screen.height * 0.92, 720);
  model.scale.set(targetH / model.height);

  // 取参数（同时保留 coreModel 的真实引用，因为 PIXI wrapper 不是真 array）
  params = model.internalModel.coreModel.parameters || model.internalModel.coreModel._parameterIds.map((id, i) => ({
    id,
    get value() { return model.internalModel.coreModel._parameterValues[i]; },
    set value(v) { model.internalModel.coreModel._parameterValues[i] = v; },
  }));
  // 把核心模型引用也存到 window 供 morph 模块复用
  window.__core = model.internalModel.coreModel;

  // 更新状态条
  hideStatus();
  document.getElementById("model-size").textContent =
    `${Math.round(model.width)}×${Math.round(model.height)}`;
  document.getElementById("param-count").textContent = `${params.length} 个`;
  const texCount = (model.internalModel.textures || []).length;
  document.getElementById("tex-count").textContent = `${texCount} 张`;

  // HitArea 数量
  try {
    const settings = model.internalModel.settings;
    const hitAreaCount = (settings.hitAreas || []).length;
    document.getElementById("hitarea-count").textContent = `${hitAreaCount} 个`;
  } catch (e) {
    document.getElementById("hitarea-count").textContent = "?";
  }

  bindCoreSliders();
  bindMotionButtons();
  bindCatActionButtons();
  drawSkeletonTree();
  applyRuntimeMorph();   // 🆕 运行时把"人形"变成"猫形"（不需 Cubism Editor）
}

function createCanvas() {
  const wrap = document.getElementById("canvas-wrap");
  const old = wrap.querySelector("canvas");
  if (old) old.remove();
  const canvas = document.createElement("canvas");
  wrap.appendChild(canvas);
  return canvas;
}

function setStatus(msg) {
  const el = document.getElementById("status-overlay");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideStatus() {
  document.getElementById("status-overlay").classList.add("hidden");
}

// === 17 个滑块绑定 ===
function bindCoreSliders() {
  if (params.length > 0) {
    console.log("[Morph Demo] 参数数量:", params.length);
  }

  let warnCount = 0;
  KEY_PARAMS.forEach((name) => {
    const idx = params.findIndex((p) => p.id === name);
    const slider = document.getElementById(`sl-${name}`);
    const valEl = document.getElementById(`v-${name}`);

    if (!slider) return;

    slider.disabled = false;
    slider.step = "0.01";

    if (idx >= 0) {
      const p = params[idx];
      const currentVal = (p.value != null) ? p.value : (p.defaultValue ?? 0);
      slider.value = String(currentVal);
      if (valEl) valEl.textContent = Number(currentVal).toFixed(2);
    } else {
      // 参数没找到 → 在改造后的 moc3 中是预期行为
      slider.value = "0";
      if (valEl) valEl.textContent = "0.00";
      if (warnCount < 3) {
        console.info("[Morph Demo] 参数未找到（等 Cubism Editor 操作 moc3 后才生效）:", name);
        warnCount++;
      }
    }

    slider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (idx >= 0) params[idx].value = v;
      if (valEl) valEl.textContent = v.toFixed(2);
    });
  });
}

// === 动效按钮（原 Natori motion3.json） ===
function bindMotionButtons() {
  document.querySelectorAll(".btn-motion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const index = parseInt(btn.dataset.index, 10);
      // 跳过 TailSwing / EarTwitch 占位（moc3 改造后才能跑）
      if (group === "TailSwing" || group === "EarTwitch") {
        console.warn("[Morph Demo] 此动效需要 Cubism Editor 操作完毕后才有 motion 文件:", group);
        return;
      }
      model.motion(group, index).catch((e) => console.warn("motion fail", e));
    });
  });
}

// === 猫化动作按钮（手动驱动参数 + easing） ===
function bindCatActionButtons() {
  document.querySelectorAll(".btn-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      switch (action) {
        case "shake-tail": return shakeTail();
        case "twitch-ear": return twitchEar();
        case "purr": return purrHead();
        case "wake-up": return wakeUp();
      }
    });
  });
}

// 甩尾 3 秒：ParamTailSwing 振荡 5 次，缓出
function shakeTail() {
  const idx = params.findIndex((p) => p.id === "ParamTailSwing");
  if (idx < 0) return;
  const duration = 3000;
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    // 衰减振幅
    const amp = (1 - t) * 1;
    // 5 次摆动 + 缓出
    const wave = Math.sin(t * Math.PI * 5) * amp;
    params[idx].value = wave;
    if (t < 1) requestAnimationFrame(step);
    else params[idx].value = 0;
  }
  requestAnimationFrame(step);
}

// 双耳抖动：左耳和右耳交替 quick flutter
function twitchEar() {
  const idxL = params.findIndex((p) => p.id === "ParamCatEarLRot");
  const idxR = params.findIndex((p) => p.id === "ParamCatEarRRot");
  if (idxL < 0 && idxR < 0) return;
  const start = performance.now();
  const duration = 800;
  function step(now) {
    const t = (now - start) / duration;
    if (t >= 1) {
      if (idxL >= 0) params[idxL].value = 0;
      if (idxR >= 0) params[idxR].value = 0;
      return;
    }
    // 左耳 +0.7，右耳 -0.5 错相
    if (idxL >= 0) params[idxL].value = Math.sin(t * Math.PI * 6) * 0.7 * (1 - t);
    if (idxR >= 0) params[idxR].value = Math.sin(t * Math.PI * 6 + Math.PI / 2) * 0.5 * (1 - t);
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// 蹭头：ParamBodyAngleX 缓慢左右小幅度摆动 4 次
function purrHead() {
  const idx = params.findIndex((p) => p.id === "ParamBodyAngleX");
  if (idx < 0) return;
  const start = performance.now();
  const duration = 4000;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    // 0.15 振幅 + 4 次摆动 + ease-in-out
    const wave = Math.sin(t * Math.PI * 4) * 0.15;
    params[idx].value = wave;
    if (t < 1) requestAnimationFrame(step);
    else params[idx].value = 0;
  }
  requestAnimationFrame(step);
}

// 伸懒腰：ParamAllRotate 缓慢拉伸
function wakeUp() {
  const idx = params.findIndex((p) => p.id === "ParamAllRotate");
  if (idx < 0) return;
  const start = performance.now();
  const duration = 2500;
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    // easeInOutSine 风格的 0→0.3→0
    const phase = t < 0.5 ? (t * 2) : (1 - (t - 0.5) * 2);
    params[idx].value = Math.sin(phase * Math.PI / 2) * 0.3;
    if (t < 1) requestAnimationFrame(step);
    else params[idx].value = 0;
  }
  requestAnimationFrame(step);
}

// === FPS ===
function startFps() {
  const el = document.getElementById("fps");
  app.ticker.add(() => {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 1000) {
      el.textContent = String(fpsFrames);
      fpsFrames = 0;
      fpsLast = now;
    }
  });
}

// === 全局错误显示 ===
window.addEventListener("error", (e) => {
  console.error(e);
  setStatus("❌ 错误：" + (e.message || "未知"));
});

// === 骨架结构树（精简后：8 组 / 21 参数） ===
const SKELETON_TREE_MORPH = {
  name: "猫化 Natori 全体",
  color: "#3a2a14",
  children: [
    {
      name: "整体移动 (3)", color: "#999",
      params: "ParamAllX / Y / Rotate",
      children: [],
    },
    {
      name: "头 (3)", color: "#ff9966",
      params: "ParamAngleX / Y / Z",
      children: [],
    },
    {
      name: "体 (3 + 呼吸)", color: "#66cc66",
      params: "ParamBodyAngleX / Y / Z + Breath",
      children: [],
    },
    {
      name: "左臂 (3 段)", color: "#cc66ff",
      params: "ParamArmAL01 / 02 / 03",
      children: [
        { name: "肩 → 肘 → 腕", color: "#ddaaff", params: "AL01 / 02 / 03" },
      ],
    },
    {
      name: "右臂 (3 段)", color: "#6688ff",
      params: "ParamArmAR01 / 02 / 03",
      children: [
        { name: "肩 → 肘 → 腕", color: "#aaccff", params: "AR01 / 02 / 03" },
      ],
    },
    {
      name: "嘴 (1)", color: "#ff8866",
      params: "ParamMouthOpenY",
      children: [],
    },
    {
      name: "🆕 猫耳 (2)", color: "#ff66aa",
      params: "ParamCatEarLRot / RRot",
      children: [
        { name: "左耳独立抖动", color: "#ffaadd", params: "LRot" },
        { name: "右耳独立抖动", color: "#ffaadd", params: "RRot" },
      ],
    },
    {
      name: "🆕 尾巴 (2)", color: "#aa8800",
      params: "ParamTailSwing / Curl",
      children: [
        { name: "左右摆", color: "#d4b886", params: "Swing" },
        { name: "卷曲度", color: "#d4b886", params: "Curl" },
      ],
    },
  ],
};

function drawSkeletonTree() {
  const svg = document.getElementById("skeleton-svg");
  if (!svg) return;

  let html = "";
  let y = 30;
  const x0 = 30;
  const rootW = 220;

  // 根节点
  html += `<rect x="${x0}" y="${y}" width="${rootW}" height="36" rx="8"
            fill="${SKELETON_TREE_MORPH.color}" fill-opacity="0.9"
            stroke="${SKELETON_TREE_MORPH.color}" stroke-width="2"/>
          <text x="${x0 + rootW / 2}" y="${y + 14}" font-size="13" fill="#fff"
                text-anchor="middle" dominant-baseline="middle" font-family="sans-serif"
                font-weight="bold">${SKELETON_TREE_MORPH.name}</text>
          <text x="${x0 + rootW / 2}" y="${y + 28}" font-size="8" fill="rgba(255,255,255,0.75)"
                text-anchor="middle" dominant-baseline="middle" font-family="monospace">8 组 / 21 参数</text>`;
  y += 52;

  SKELETON_TREE_MORPH.children.forEach((cat) => {
    // 连线到根
    html += `<line x1="${x0 + 20}" y1="${30 + 18}" x2="${x0 + 20}" y2="${y - 8}" stroke="#d4b886" stroke-width="1.2" stroke-dasharray="3 2"/>`;

    // 一级节点
    const w = 200;
    const h = 32;
    html += `<rect x="${x0 + 30}" y="${y}" width="${w}" height="${h}" rx="6"
              fill="${cat.color}" fill-opacity="0.85" stroke="${cat.color}" stroke-width="2"/>
            <text x="${x0 + 30 + w / 2}" y="${y + 13}" font-size="11" fill="#fff"
                  text-anchor="middle" dominant-baseline="middle" font-family="sans-serif"
                  font-weight="bold">${cat.name}</text>
            <text x="${x0 + 30 + w / 2}" y="${y + 25}" font-size="8" fill="rgba(255,255,255,0.7)"
                  text-anchor="middle" dominant-baseline="middle" font-family="monospace">${cat.params || ""}</text>`;

    let curY = y + h + 8;

    // 二级子节点
    cat.children.forEach((sub) => {
      html += `<line x1="${x0 + 50}" y1="${y + h}" x2="${x0 + 80}" y2="${curY + 11}" stroke="${sub.color}" stroke-width="1" opacity="0.5"/>`;
      const sw = 200;
      const sh = 22;
      html += `<rect x="${x0 + 80}" y="${curY}" width="${sw}" height="${sh}" rx="4"
                fill="${sub.color}" fill-opacity="0.65" stroke="${sub.color}" stroke-width="1"/>
              <text x="${x0 + 88}" y="${curY + 14}" font-size="10" fill="#3a2a14"
                    text-anchor="start" dominant-baseline="middle" font-family="sans-serif"
                    font-weight="600">${sub.name}</text>
              <text x="${x0 + 80 + sw - 6}" y="${curY + 14}" font-size="8" fill="rgba(58,42,20,0.5)"
                    text-anchor="end" dominant-baseline="middle" font-family="monospace">${sub.params || ""}</text>`;
      curY += sh + 4;
    });

    y = Math.max(y + h + 8, curY + 12);
  });

  svg.innerHTML = html;
  // 动态调整 viewBox
  const totalH = y + 20;
  const totalW = x0 + 80 + 220 + 30;
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
}

// =============================================================
// 🆕 运行时改造：不需 Cubism Editor，直接改 coreModel._partOpacities
// 原理：Cubism Core 把每个 Part 的 opacity 存为 0-1 的连续数值
//       _partOpacities[i] = 0 → 该 Part 下所有 ArtMesh 完全不可见
//       _partOpacities[i] = 1 → 完全可见
// 注意：moc3 未改造时也能用！这是运行时折中方案，效果已验证 ✅
// =============================================================

// 按语义分组的 Part ID（来自实际 dump 的 _partIds）
const PART_GROUPS = {
  hair:   ["PartHairFront", "PartHairBack", "PartHairLine", "PartHairShadow", "PartHairSide"],
  clothes: ["PartJacket"],
  glasses: ["PartGlass"],
  watch:  ["PartWatchA", "PartWatchB"],
  // 手部分（前臂/腕）— 保留 PartArmAL/AR 不动（用户要肩+臂）
  hands:  ["PartHand11", "PartHand21", "PartHand31", "PartHand41", "PartHand51", "PartHand61"],
  // 用户明确不要脸/嘴/头/身体：保留
};

function applyRuntimeMorph() {
  if (!model) return;
  const core = model.internalModel.coreModel;
  const partIds = core._partIds;        // Array of string
  const partOp = core._partOpacities;   // Float32Array-like

  // 只对 Natori 改造模型有效（Mao/Wanko 不需要 Part 隐藏）
  const hasNatoriParts = partIds.indexOf("PartJacket") >= 0;
  if (!hasNatoriParts) {
    console.log("[Runtime Morph] 当前模型不是 Natori,跳过 Part 隐藏逻辑");
    document.getElementById("morph-status").textContent = "N/A (此模型已是动物)";
    return;
  }

  // 缓存原值（用于"还原人形"按钮）
  if (!window.__partOpacityBackup) {
    window.__partOpacityBackup = Array.from(partOp);
  }

  const allHidable = [
    ...PART_GROUPS.hair,
    ...PART_GROUPS.clothes,
    ...PART_GROUPS.glasses,
    ...PART_GROUPS.watch,
    ...PART_GROUPS.hands,
  ];

  // 构建 partId → index 索引（只算一次）
  const idToIdx = {};
  for (let i = 0; i < partIds.length; i++) idToIdx[partIds[i]] = i;

  // 绑定 4 个按钮（只绑定一次）
  if (!window.__runtimeMorphBound) {
    window.__runtimeMorphBound = true;
    document.querySelectorAll("button[data-morph]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.morph;
        let targets = [];
        let label = "";
        switch (action) {
          case "cat":
            targets = allHidable;
            label = "🐱 猫形(隐藏头发/衣服/眼镜/手表/手)";
            break;
          case "human":
            targets = [];
            label = "👤 人形(还原)";
            break;
          case "hair-only":
            targets = PART_GROUPS.hair;
            label = "💇‍♀️ 仅隐藏头发";
            break;
          case "clothes-only":
            targets = [...PART_GROUPS.clothes, ...PART_GROUPS.glasses, ...PART_GROUPS.watch];
            label = "👔 隐藏衣服+眼镜+手表";
            break;
        }

        if (action === "human") {
          // 还原
          for (let i = 0; i < partOp.length; i++) partOp[i] = window.__partOpacityBackup[i];
          // 还原所有参数为 0
          const paramVals = core._parameterValues;
          for (let i = 0; i < paramVals.length; i++) paramVals[i] = 0;
        } else if (action === "cat-crouch") {
          // 隐藏 + 弯腰：身体前倾 + 头向下 + 手臂下垂
          targets = allHidable;
          label = "🐾 趴下变猫(隐藏+弯腰)";
          targets.forEach((partId) => {
            const idx = idToIdx[partId];
            if (idx != null) partOp[idx] = 0;
          });
          // 调姿势
          const pv = core._parameterValues;
          const setParam = (name, val) => {
            const i = core._parameterIds.indexOf(name);
            if (i >= 0) pv[i] = val;
          };
          setParam("ParamBodyAngleX", 0.6);   // 身体向后坐（让它后腿立起来）
          setParam("ParamBodyAngleY", -0.5);  // 身体略向左
          setParam("ParamAngleX", 0);
          setParam("ParamAngleY", -0.3);      // 头微向下看
          setParam("ParamAngleZ", 0);
          setParam("ParamArmAL01", -0.2);
          setParam("ParamArmAL02", -0.4);
          setParam("ParamArmAL03", 0.2);
          setParam("ParamArmAR01", -0.2);
          setParam("ParamArmAR02", -0.4);
          setParam("ParamArmAR03", 0.2);
          setParam("ParamAllY", 0.4);
        } else {
          // 隐藏指定 Part
          targets.forEach((partId) => {
            const idx = idToIdx[partId];
            if (idx != null) partOp[idx] = 0;
          });
        }
        document.getElementById("morph-status").textContent = label;
        console.log("[Runtime Morph]", label, "— 修改 Part 数:", action === "human" ? partOp.length : targets.length);
      });
    });
  }

  console.log("[Runtime Morph] 初始化完成,Part 数量:", partIds.length);
  console.log("[Runtime Morph] 可隐藏 Part:", allHidable.join(", "));
  console.log("[Runtime Morph] 默认隐藏: 无(等待用户点击 '一键变猫')");
}