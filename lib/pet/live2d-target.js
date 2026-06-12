const fs = require("node:fs");
const path = require("node:path");

const SAMPLE_MODEL_MARKERS = ["shizuku"];

function listModelJsonFiles(shellModelsDir) {
  if (!fs.existsSync(shellModelsDir)) return [];

  const results = [];
  const stack = [shellModelsDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".model3.json")) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function toConfigBaseUrl(projectRoot, absoluteModelPath) {
  const shellDir = path.join(projectRoot, "desktop-pet-shell");
  const relative = path.relative(shellDir, absoluteModelPath).replace(/\\/g, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function isSampleModel(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  return SAMPLE_MODEL_MARKERS.some((marker) => normalized.includes(`/${marker}/`));
}

function getLive2DStatus(projectRoot) {
  const shellModelsDir = path.join(projectRoot, "desktop-pet-shell", "models");
  const modelFiles = listModelJsonFiles(shellModelsDir);
  const customModels = modelFiles.filter((filePath) => !isSampleModel(filePath));
  const sampleModels = modelFiles.filter((filePath) => isSampleModel(filePath));

  if (customModels.length > 0) {
    return {
      available: true,
      source: "custom",
      modelPath: customModels[0],
      message: "已找到专属 Live2D 模型。"
    };
  }

  if (sampleModels.length > 0) {
    return {
      available: false,
      source: "sample_only",
      modelPath: sampleModels[0],
      message: "当前只有示例 Live2D 模型，尚未接入你的专属桌宠模型。"
    };
  }

  return {
    available: false,
    source: "missing",
    modelPath: null,
    message: "当前还没有可用的 Live2D 模型文件。"
  };
}

function resolveLive2DModelTarget(projectRoot) {
  const status = getLive2DStatus(projectRoot);
  if (!status.available || !status.modelPath) {
    return {
      ok: false,
      reason: status.source,
      message: status.message
    };
  }

  return {
    ok: true,
    source: status.source,
    config: {
      mode: "live2d",
      baseUrl: toConfigBaseUrl(projectRoot, status.modelPath)
    }
  };
}

module.exports = {
  getLive2DStatus,
  resolveLive2DModelTarget
};
