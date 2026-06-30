// Live2D 模型解剖教学 Demo · 主逻辑
// 目标：让 cieLago 一眼看清 Live2D 模型长什么样、能改什么

const MODEL_PATH = "/models/pet-human-natori/Natori.model3.json";
const TEXTURE_PATH = "/models/pet-human-natori/Natori.2048/texture_00.png";

// 让 PIXI 知道 Live2D 后端
if (PIXI.live2d && PIXI.live2d.Live2DModel) {
  PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
}

const KEY_PARAMS = [
  "ParamAngleX", "ParamAngleY", "ParamAngleZ",
  "ParamEyeLOpen", "ParamMouthOpenY", "ParamBodyAngleX",
];

// 表情名字 → 中文翻译
const EXPRESSION_NAMES_CN = {
  "Normal": "正常",
  "Smile": "微笑",
  "Angry": "生气",
  "Sad": "悲伤",
  "Surprised": "惊讶",
  "Blushing": "脸红",
  "exp_01": "眼形变化",
  "exp_02": "眉形变化",
  "exp_03": "嘴形变化",
  "exp_04": "特殊表情 4",
  "exp_05": "特殊表情 5",
};
const HOTSPOT_PARAMS = {
  eyes: ["ParamEyeLOpen", "ParamEyeROpen", "ParamEyeBallX", "ParamEyeBallY"],
  mouth: ["ParamMouthOpenY", "ParamMouthForm", "ParamMouthSmile", "ParamMouthPucker"],
  brow: ["ParamBrowLY", "ParamBrowRY", "ParamBrowLX", "ParamBrowRX", "ParamBrowLAngle", "ParamBrowRAngle"],
  head: ["ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamCheek"],
  body: ["ParamBodyAngleX", "ParamBodyAngleY", "ParamBodyAngleZ", "ParamBreath"],
  arm: ["ParamArmLA", "ParamArmLB", "ParamArmRA", "ParamArmRB", "ParamHandL", "ParamHandR"],
  hair: ["ParamHairFront", "ParamHairSide", "ParamHairBack", "ParamSkirt"],
};

// UV 蒙版矩形（基于 Natori.cdi3.json 实际值，仅供教学展示，不要求 100% 像素准确）
const UV_MESH_REGIONS = [
  { name: "头发后", color: "#ff6666", x: 200, y: 0, w: 800, h: 350 },
  { name: "头发侧", color: "#ffaaaa", x: 100, y: 300, w: 400, h: 400 },
  { name: "脸", color: "#ffdd66", x: 600, y: 300, w: 700, h: 600 },
  { name: "眼睛", color: "#66ccff", x: 700, y: 500, w: 280, h: 120 },
  { name: "嘴", color: "#cc66ff", x: 850, y: 700, w: 200, h: 150 },
  { name: "衣领", color: "#66ff77", x: 500, y: 900, w: 900, h: 400 },
  { name: "左臂", color: "#ffaa44", x: 100, y: 1100, w: 380, h: 700 },
  { name: "右臂", color: "#ffaa44", x: 1450, y: 1100, w: 380, h: 700 },
  { name: "裙摆", color: "#8888ff", x: 400, y: 1300, w: 1100, h: 600 },
  { name: "腿部", color: "#444444", x: 500, y: 1850, w: 900, h: 200 },
];

let app = null;
let model = null;
let params = [];
let fpsFrames = 0;
let fpsLast = performance.now();

window.addEventListener("DOMContentLoaded", main);

async function main() {
  setStatus("⏳ 加载 PIXI 应用…");

  // 1. 直接显示贴图（绕过 PIXI，立刻有"Live2D 相关"东西看）
  const texImg = document.getElementById("texture-only-img");
  texImg.src = TEXTURE_PATH;
  texImg.onerror = () => {
    texImg.alt = "❌ 贴图加载失败：" + TEXTURE_PATH;
  };
  const uvImg = document.getElementById("uv-base-img");
  uvImg.src = TEXTURE_PATH;
  drawUVOverlay();

  // 2. PIXI 加载模型
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

  setStatus("⏳ 加载 Natori 模型（首次需要几秒）…");
  try {
    model = await PIXI.live2d.Live2DModel.from(MODEL_PATH, { autoInteract: true });
  } catch (e) {
    setStatus("❌ 模型加载失败：" + e.message + "\n路径：" + MODEL_PATH);
    return;
  }

  app.stage.addChild(model);

  // 居中 + 缩放
  model.anchor.set(0.5, 0.5);
  model.x = app.screen.width / 2;
  model.y = app.screen.height / 2;
  const targetH = Math.min(app.screen.height * 0.92, 720);
  model.scale.set(targetH / model.height);

  // 取参数
  params = model.internalModel.coreModel.parameters || [];

  // 更新状态条
  hideStatus();
  document.getElementById("model-size").textContent =
    `${Math.round(model.width)}×${Math.round(model.height)}`;
  document.getElementById("param-count").textContent = `${params.length} 个`;
  const texCount = (model.internalModel.textures || []).length;
  document.getElementById("tex-count").textContent = `${texCount} 张`;

  bindCoreSliders();
  renderExpressions();
  renderAllParams();
  bindMotionButtons();
  bindHotspotButtons();
  drawSkeletonTree();
  startFps();
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

// === ① 核心滑块 ===
function bindCoreSliders() {
  // 调试：打印前 3 个参数对象的结构
  if (params.length > 0) {
    console.log("[Natori Demo] 参数数量:", params.length);
    console.log("[Natori Demo] 前3个参数:", JSON.stringify(params.slice(0, 3), null, 2));
    console.log("[Natori Demo] 第1个参数的 keys:", Object.keys(params[0]));
  }

  KEY_PARAMS.forEach((name) => {
    const idx = params.findIndex((p) => p.id === name);
    const slider = document.getElementById(`sl-${name}`);
    const valEl = document.getElementById(`v-${name}`);

    if (!slider) return;

    // 关键修复：不从参数对象覆盖 min/max，只用 HTML 已有的默认值
    // HTML 里已经设好了 min="-1" max="1"（或 min="0" max="1"），覆盖会导致 NaN
    slider.disabled = false;
    slider.step = "0.01";

    if (idx >= 0) {
      const p = params[idx];
      // 只同步当前值（value/defaultValue 是最常见的属性名）
      const currentVal = (p.value != null) ? p.value : (p.defaultValue ?? 0);
      slider.value = String(currentVal);
      if (valEl) valEl.textContent = Number(currentVal).toFixed(2);
    } else {
      // 参数没找到，slider 仍可用，只是不会联动模型
      slider.value = "0";
      if (valEl) valEl.textContent = "0.00";
      console.warn("[Natori Demo] 参数未找到:", name);
    }

    slider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      if (idx >= 0) params[idx].value = v;
      if (valEl) valEl.textContent = v.toFixed(2);
    });
  });
}

// === ③ 表情按钮 ===
function renderExpressions() {
  const grid = document.getElementById("expression-grid");
  const settings = model.internalModel.settings;
  if (!settings || !settings.expressions) return;
  settings.expressions.forEach((exp, i) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-expression";
    const rawName = exp.Name || exp.name || `exp_${i}`;
    btn.textContent = EXPRESSION_NAMES_CN[rawName] || rawName;
    btn.addEventListener("click", () => model.expression(i));
    grid.appendChild(btn);
  });
}

// === ② 动效按钮 ===
function bindMotionButtons() {
  document.querySelectorAll(".btn-motion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const index = parseInt(btn.dataset.index, 10);
      model.motion(group, index).catch((e) => console.warn("motion fail", e));
    });
  });
}

// === ④ 热点 ===
function bindHotspotButtons() {
  const display = document.getElementById("hotspot-param-display");
  const labels = { eyes: "👀 眼睛", mouth: "👄 嘴巴", brow: "🤨 眉毛", head: "🗣 头部", body: "💪 身体", arm: "💅 手臂", hair: "💇 头发" };
  document.querySelectorAll(".btn-hotspot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      document.querySelectorAll(".btn-hotspot").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const list = HOTSPOT_PARAMS[target] || [];
      display.innerHTML = `<b>${labels[target] || target}</b> → 控制 ${list.length} 个参数：<br>${list.map((p) => `<code>${p}</code>`).join(" · ")}`;
      highlightParams(list);
    });
  });
}

function highlightParams(paramIds) {
  document.querySelectorAll(".param-row").forEach((row) => {
    row.classList.toggle("highlight", paramIds.includes(row.dataset.id));
  });
}

// === ⑤ 全部参数 ===
function renderAllParams() {
  const wrap = document.getElementById("all-params");
  wrap.innerHTML = "";
  params.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "param-row";
    row.dataset.idx = String(i);
    row.dataset.id = p.id;

    const name = document.createElement("span");
    name.className = "pname";
    name.textContent = p.id;

    const slider = document.createElement("input");
    slider.type = "range";

    // 关键修复：不读 p.min/p.max（可能是 undefined），直接用安全默认值
    // 绝大多数 Live2D 参数在 [-1, 1] 区间，眼开合类在 [0, 1]
    const isEyeOpen = p.id && (p.id.includes("Eye") && p.id.includes("Open"));
    slider.min = isEyeOpen ? "0" : "-1";
    slider.max = "1";
    slider.step = "0.05";
    const currentVal = (p.value != null) ? p.value : (p.defaultValue ?? 0);
    slider.value = String(currentVal);

    const val = document.createElement("span");
    val.className = "pval";
    val.textContent = Number(currentVal).toFixed(1);

    slider.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      p.value = v;
      val.textContent = v.toFixed(2);
    });

    row.appendChild(name);
    row.appendChild(slider);
    row.appendChild(val);
    wrap.appendChild(row);
  });
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

// === UV 蒙版（教学示意图） ===
function drawUVOverlay() {
  const svg = document.getElementById("uv-svg");
  if (!svg) return;
  let html = "";
  UV_MESH_REGIONS.forEach((r) => {
    html += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
              fill="${r.color}" fill-opacity="0.35"
              stroke="${r.color}" stroke-width="6" />
             <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}"
                   font-size="60" fill="#222" text-anchor="middle"
                   dominant-baseline="middle" font-family="sans-serif"
                   font-weight="bold" fill-opacity="0.85">${r.name}</text>`;
  });
  svg.innerHTML = html;
}

// === 全局错误显示 ===
window.addEventListener("error", (e) => {
  console.error(e);
  setStatus("❌ 错误：" + (e.message || "未知"));
});

// === ④ 骨架结构树（参数组层级图） ===
const SKELETON_TREE = {
  name: "Natori 全体",
  color: "#3a2a14",
  children: [
    {
      name: "整体移动 (3)", color: "#999", params: "ParamAllX/Y/Rotate",
      children: [],
    },
    {
      name: "表情 (28)", color: "#ff9966",
      children: [
        { name: "左眼 (3)", color: "#ffccaa", params: "EyeLOpen/Smile/Form" },
        { name: "右眼 (3)", color: "#ffccaa", params: "EyeROpen/Smile/Form" },
        { name: "眼球 (3)", color: "#ffccaa", params: "EyeBallX/Y/Form" },
        { name: "左眉 (5)", color: "#ffddbb", params: "BrowLY/LX/LAngle/LForm/LForm2" },
        { name: "右眉 (5)", color: "#ffddbb", params: "BrowRY/RX/RAngle/RForm/RForm2" },
        { name: "嘴 (4)", color: "#ff8866", params: "MouthForm/OpenY/Form2/Teeth" },
        { name: "其他 (5)", color: "#ffaa88", params: "Cheek/Glass*/Grass*" },
      ],
    },
    {
      name: "身体 (8)", color: "#66cc66",
      children: [
        { name: "体回转 (3)", color: "#aaddaa", params: "BodyAngleX/Y/Z" },
        { name: "腰/位置/呼吸 (3)", color: "#aaddaa", params: "WaistAngleZ/BodyPosition/Breath" },
        { name: "肩膀 (2)", color: "#aaddaa", params: "LeftShoulderUp/RightShoulderUp" },
      ],
    },
    {
      name: "右手 (23)", color: "#6688ff",
      children: [
        { name: "右腕A 肩→手 (4)", color: "#aaccff", params: "ArmAR01/02/03/04" },
        { name: "右腕B 肩→指 (9)", color: "#aaccff", params: "ArmBR01/02/03 + Hand01/05" },
        { name: "右腕E 肩→指 (10)", color: "#aaccff", params: "ArmER01/02/03/04 + Hand04/06" },
      ],
    },
    {
      name: "左手 (12)", color: "#cc66ff",
      children: [
        { name: "左腕A 肩→手 (4)", color: "#ddaaff", params: "ArmAL01/02/03/04" },
        { name: "左腕C 肩→指 (4)", color: "#ddaaff", params: "ArmCR01/02/03 + HandRoll1" },
        { name: "左腕D 肩→指 (4)", color: "#ddaaff", params: "ArmDL01/02/03 + HandRoll" },
      ],
    },
    {
      name: "头发摇摆 (6)", color: "#ffcc00",
      children: [
        { name: "前/侧/后 (3)", color: "#ffee88", params: "HairFront/Side/Back" },
        { name: "ふわ (3)", color: "#ffee88", params: "HairFrontFuwa/SideFuwa/BackFuwa" },
      ],
    },
    {
      name: "衣服/饰品摇摆 (5)", color: "#88cccc",
      children: [
        { name: "夹克/链子/手表 (5)", color: "#bbeeff", params: "Jacket/ChainWaist/WatchSwing*" },
      ],
    },
    {
      name: "怀表 (8)", color: "#999966",
      children: [
        { name: "表A (1)", color: "#cccca0", params: "WatchAX" },
        { name: "表B (7)", color: "#cccca0", params: "WatchB*" },
      ],
    },
  ],
};

function drawSkeletonTree() {
  const svg = document.getElementById("skeleton-svg");
  if (!svg) return;

  let html = "";
  let y = 30;
  const x0 = 60;
  const lineStartX = x0 + 10;

  // 根节点
  html += drawNode(SKELETON_TREE, 0, x0, lineStartX, y, 1);
  y += 52;

  // 一级子节点（6 大类）
  SKELETON_TREE.children.forEach((cat, ci) => {
    // 连线到根
    html += `<line x1="${lineStartX}" y1="${30 + 24}" x2="${x0 - 20}" y2="${y + 18}" stroke="#d4b886" stroke-width="1.5" stroke-dasharray="4 2"/>`;
    // 连线到左侧标注
    html += `<line x1="${x0 - 20}" y1="${y + 18}" x2="${x0 + 30}" y2="${y + 18}" stroke="#d4b886" stroke-width="1.5"/>`;

    html += drawCategoryNode(cat, x0 + 40, y);
    const subY = y + 32;
    y += Math.max(32, cat.children.length * 26) + 24;

    // 二级子节点
    cat.children.forEach((sub, si) => {
      const sy = subY + si * 26;
      html += `<line x1="${x0 + 55}" y1="${subY - 8}" x2="${x0 + 65}" y2="${sy + 10}" stroke="${sub.color}" stroke-width="1" opacity="0.4"/>`;
      html += drawSubNode(sub, x0 + 75, sy);
    });
  });

  svg.innerHTML = html;
  // 动态调整 SVG 高度
  svg.setAttribute("viewBox", `0 0 600 ${y + 20}`);
}

function drawNode(node, x, lx, ly, level) {
  const w = level === 0 ? 240 : 180;
  const h = 32;
  return `<rect x="${x}" y="${ly}" width="${w}" height="${h}" rx="8"
            fill="${node.color}" fill-opacity="0.9" stroke="${node.color}" stroke-width="2"/>
          <text x="${x + w / 2}" y="${ly + 12}" font-size="13" fill="#fff"
                text-anchor="middle" dominant-baseline="middle" font-family="sans-serif"
                font-weight="bold">${node.name}</text>
          <text x="${x + w / 2}" y="${ly + 25}" font-size="8" fill="rgba(255,255,255,0.75)"
                text-anchor="middle" dominant-baseline="middle" font-family="monospace">${node.params || ""}</text>`;
}

function drawCategoryNode(node, x, y) {
  const w = 130;
  const h = 28;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"
            fill="${node.color}" fill-opacity="0.85" stroke="${node.color}" stroke-width="2"/>
          <text x="${x + w / 2}" y="${y + 18}" font-size="11" fill="#fff"
                text-anchor="middle" dominant-baseline="middle" font-family="sans-serif"
                font-weight="bold">${node.name}</text>`;
}

function drawSubNode(node, x, y) {
  const w = 180;
  const h = 22;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"
            fill="${node.color}" fill-opacity="0.7" stroke="${node.color}" stroke-width="1"/>
          <text x="${x + 8}" y="${y + 14}" font-size="10" fill="#3a2a14"
                text-anchor="start" dominant-baseline="middle" font-family="sans-serif"
                font-weight="600">${node.name}</text>
          <text x="${x + w - 6}" y="${y + 14}" font-size="7" fill="rgba(58,42,20,0.5)"
                text-anchor="end" dominant-baseline="middle" font-family="monospace">${node.params || ""}</text>`;
}