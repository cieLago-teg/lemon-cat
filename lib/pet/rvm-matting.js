const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Jimp } = require("jimp");

const MODEL_SIZE = 1024;
let cachedSessionPromise = null;

async function ensureRvmModel() {
  const modelDir = path.join(process.cwd(), "models", "rmbg");
  const modelPath = path.join(modelDir, "rmbg-1.4.onnx");
  
  if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 1000000) {
    console.log("正在下载 RMBG-1.4 模型，这可能需要一些时间...");
    fs.mkdirSync(modelDir, { recursive: true });
    const url = "https://hf-mirror.com/briaai/RMBG-1.4/resolve/main/onnx/model.onnx";
    try {
      const dlRes = spawnSync("curl", ["-L", "-o", modelPath, url], { stdio: "inherit" });
      if (dlRes.error || dlRes.status !== 0) {
        throw new Error(`curl failed`);
      }
    } catch (e) {
      throw new Error(`RMBG 模型下载失败: ${e.message}`);
    }
  }
  return modelPath;
}

function defaultFfmpegCandidates() {
  return [
    process.env.FFMPEG_PATH,
    path.join(
      process.cwd(),
      "node_modules",
      "@ffmpeg-installer",
      process.platform === "win32" ? "win32-x64" : `${process.platform}-${process.arch}`,
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    ),
    path.join(process.cwd(), "bin", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    "ffmpeg"
  ].filter(Boolean);
}

function probeExecutable(candidate) {
  if (candidate !== "ffmpeg" && !fs.existsSync(candidate)) {
    return false;
  }
  const probe = spawnSync(candidate, ["-version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

function resolveFfmpegPath(options = {}) {
  const candidates = options.candidates ?? defaultFfmpegCandidates();
  const isExecutable = options.isExecutable ?? probeExecutable;

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error("未找到可执行的 ffmpeg，请检查 FFMPEG_PATH、node_modules/@ffmpeg-installer 或 bin/ffmpeg.exe");
}

function closeBinaryMask(binaryMask, width, height, radius = 1) {
  if (radius <= 0) {
    return Uint8Array.from(binaryMask);
  }

  const size = width * height;
  const dilated = new Uint8Array(size);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let on = 0;

      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius) && !on; yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          if (binaryMask[yy * width + xx]) {
            on = 1;
            break;
          }
        }
      }

      dilated[index] = on;
    }
  }

  const closed = new Uint8Array(size);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let on = 1;

      for (let yy = y - radius; yy <= y + radius && on; yy += 1) {
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) {
            on = 0;
            break;
          }
          if (!dilated[yy * width + xx]) {
            on = 0;
            break;
          }
        }
      }

      closed[index] = on;
    }
  }

  return closed;
}

async function getMattingSession() {
  if (!cachedSessionPromise) {
    cachedSessionPromise = (async () => {
      const ort = require("onnxruntime-node");
      const modelPath = await ensureRvmModel();
      return ort.InferenceSession.create(modelPath, {
        executionProviders: ["cpu"]
      });
    })();
  }
  return cachedSessionPromise;
}

function solidifyAlphaMask(alphaBytes, width, height, options = {}) {
  const keepThreshold = options.keepThreshold ?? 96;
  const size = width * height;
  const closeRadius = options.closeRadius ?? 1;
  const rimOpaque = options.rimOpaque ?? false;
  const binaryForeground = new Uint8Array(size);
  const backgroundVisited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < size; i += 1) {
    binaryForeground[i] = alphaBytes[i] >= keepThreshold ? 1 : 0;
  }

  const sealedForeground = closeBinaryMask(binaryForeground, width, height, closeRadius);

  const tryPush = (index) => {
    if (index < 0 || index >= size) return;
    if (backgroundVisited[index]) return;
    if (sealedForeground[index]) return;
    backgroundVisited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(y * width);
    tryPush(y * width + (width - 1));
  }

  const directions = [-1, 1, -width, width];

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    for (const delta of directions) {
      const next = index + delta;
      if (next < 0 || next >= size) continue;
      const nextX = next % width;
      const nextY = Math.floor(next / width);
      if (Math.abs(nextX - x) > 1 || Math.abs(nextY - y) > 1) continue;
      tryPush(next);
    }
  }

  const refined = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    refined[i] = backgroundVisited[i] ? 0 : 255;
  }

  if (rimOpaque) {
    // Solidify the *outer rim* of the subject: every alpha>0 pixel that is
    // 4-connected to a known foreground pixel must be promoted to opaque.
    // This eliminates the 1/255 semi-transparent gap that would otherwise
    // let the desktop background bleed through the alpha edge.
    //
    // We seed from the binary foreground (>=keepThreshold) and propagate
    // 4-neighbour onto any pixel whose ORIGINAL alpha was non-zero. Pixels
    // that were already 0 in the original mask are background and stay 0.
    //
    // Crucially, we OVERWRITE refined with 255 (not the Math.max value
    // produced by the previous step), so a leftover A=254 from the
    // soft-rim case cannot survive.
    const rimQueue = new Int32Array(size);
    let rimHead = 0;
    let rimTail = 0;
    const seen = new Uint8Array(size);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (sealedForeground[idx]) {
          rimQueue[rimTail] = idx;
          rimTail += 1;
          seen[idx] = 1;
        }
      }
    }

    const rimDirections = [-1, 1, -width, width];
    while (rimHead < rimTail) {
      const index = rimQueue[rimHead];
      rimHead += 1;
      const x = index % width;
      const y = Math.floor(index / width);

      for (const delta of rimDirections) {
        const next = index + delta;
        if (next < 0 || next >= size) continue;
        const nextX = next % width;
        const nextY = Math.floor(next / width);
        if (Math.abs(nextX - x) > 1 || Math.abs(nextY - y) > 1) continue;
        if (seen[next]) continue;
        if (alphaBytes[next] === 0) continue;
        seen[next] = 1;
        rimQueue[rimTail] = next;
        rimTail += 1;
      }
    }

    for (let i = 0; i < size; i += 1) {
      if (seen[i]) refined[i] = 255;
    }
  }

  return refined;
}

function stabiliseVideoAlphaMasks(alphaMasks, width, height) {
  if (!Array.isArray(alphaMasks) || alphaMasks.length === 0) {
    return [];
  }
  if (alphaMasks.length === 1) {
    return [Uint8Array.from(alphaMasks[0])];
  }

  const size = width * height;
  const total = alphaMasks.length;
  const output = alphaMasks.map((mask) => Uint8Array.from(mask));

  // 把整段视频视作循环序列来做时间域稳定，这样首尾衔接处也会一起被平滑，
  // 能明显减少耳朵、尾巴、毛发边缘在循环点抖一下的现象。
  for (let frameIndex = 0; frameIndex < total; frameIndex += 1) {
    const prev = alphaMasks[(frameIndex - 1 + total) % total];
    const curr = alphaMasks[frameIndex];
    const next = alphaMasks[(frameIndex + 1) % total];
    const stable = output[frameIndex];

    for (let i = 0; i < size; i += 1) {
      const votes = (prev[i] >= 128 ? 1 : 0) + (curr[i] >= 128 ? 1 : 0) + (next[i] >= 128 ? 1 : 0);
      stable[i] = votes >= 2 ? 255 : 0;
    }

    const repaired = solidifyAlphaMask(stable, width, height, {
      keepThreshold: 128,
      closeRadius: 1,
      rimOpaque: true
    });
    stable.set(repaired);
  }

  return output;
}

function decontaminateEdgeColors(image, alphaBytes, options = {}) {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const radius = options.radius ?? 2;
  const blendStrength = options.blendStrength ?? 0.72;
  const size = width * height;
  const boundary = new Uint8Array(size);
  const neighbors4 = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  const isInside = (x, y) => x >= 0 && x < width && y >= 0 && y < height;

  for (let i = 0; i < size; i += 1) {
    if (alphaBytes[i] === 0) {
      const pixel = i * 4;
      image.bitmap.data[pixel] = 0;
      image.bitmap.data[pixel + 1] = 0;
      image.bitmap.data[pixel + 2] = 0;
      continue;
    }

    const x = i % width;
    const y = Math.floor(i / width);
    for (const [dx, dy] of neighbors4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isInside(nx, ny) || alphaBytes[ny * width + nx] === 0) {
        boundary[i] = 1;
        break;
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!boundary[index]) continue;

      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let samples = 0;

      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy += 1) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx += 1) {
          const sampleIndex = yy * width + xx;
          if (sampleIndex === index) continue;
          if (alphaBytes[sampleIndex] !== 255) continue;
          if (boundary[sampleIndex]) continue;

          const pixel = sampleIndex * 4;
          sumR += image.bitmap.data[pixel];
          sumG += image.bitmap.data[pixel + 1];
          sumB += image.bitmap.data[pixel + 2];
          samples += 1;
        }
      }

      if (samples === 0) continue;

      const pixel = index * 4;
      const avgR = sumR / samples;
      const avgG = sumG / samples;
      const avgB = sumB / samples;
      image.bitmap.data[pixel] = Math.round(image.bitmap.data[pixel] * (1 - blendStrength) + avgR * blendStrength);
      image.bitmap.data[pixel + 1] = Math.round(
        image.bitmap.data[pixel + 1] * (1 - blendStrength) + avgG * blendStrength
      );
      image.bitmap.data[pixel + 2] = Math.round(
        image.bitmap.data[pixel + 2] * (1 - blendStrength) + avgB * blendStrength
      );
    }
  }
}

async function predictAlphaMask(image) {
  const session = await getMattingSession();
  const ort = require("onnxruntime-node");
  const srcData = new Float32Array(1 * 3 * MODEL_SIZE * MODEL_SIZE);

  for (let y = 0; y < MODEL_SIZE; y += 1) {
    for (let x = 0; x < MODEL_SIZE; x += 1) {
      const idx = (y * MODEL_SIZE + x) * 4;
      const dataIndex = y * MODEL_SIZE + x;
      srcData[dataIndex] = (image.bitmap.data[idx] / 255) - 0.5;
      srcData[MODEL_SIZE * MODEL_SIZE + dataIndex] = (image.bitmap.data[idx + 1] / 255) - 0.5;
      srcData[2 * MODEL_SIZE * MODEL_SIZE + dataIndex] = (image.bitmap.data[idx + 2] / 255) - 0.5;
    }
  }

  const inputTensor = new ort.Tensor("float32", srcData, [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const results = await session.run({ input: inputTensor });
  const outputName = session.outputNames[0];
  const maskData = results[outputName].data;
  const alphaBytes = new Uint8Array(MODEL_SIZE * MODEL_SIZE);

  for (let i = 0; i < alphaBytes.length; i += 1) {
    const alpha = Math.max(0, Math.min(1, Number(maskData[i]) || 0));
    alphaBytes[i] = Math.round(alpha * 255);
  }

  return solidifyAlphaMask(alphaBytes, MODEL_SIZE, MODEL_SIZE, {
    keepThreshold: 72,
    minForegroundAlpha: 224,
    rimOpaque: true
  });
}

function alphaBytesToMaskImage(alphaBytes, width, height) {
  const maskImg = new Jimp({ width, height });
  for (let i = 0; i < alphaBytes.length; i += 1) {
    const value = alphaBytes[i];
    maskImg.bitmap.data[i * 4] = value;
    maskImg.bitmap.data[i * 4 + 1] = value;
    maskImg.bitmap.data[i * 4 + 2] = value;
    maskImg.bitmap.data[i * 4 + 3] = 255;
  }
  return maskImg;
}

async function predictFinalAlphaForImage(originalImg) {
  const targetW = originalImg.bitmap.width;
  const targetH = originalImg.bitmap.height;
  const resized = originalImg.clone();
  resized.resize({ w: MODEL_SIZE, h: MODEL_SIZE });

  const modelAlpha = await predictAlphaMask(resized);
  const maskImg = alphaBytesToMaskImage(modelAlpha, MODEL_SIZE, MODEL_SIZE);
  maskImg.resize({ w: targetW, h: targetH });

  const resizedAlpha = new Uint8Array(targetW * targetH);
  for (let i = 0; i < resizedAlpha.length; i += 1) {
    resizedAlpha[i] = maskImg.bitmap.data[i * 4];
  }

  return solidifyAlphaMask(resizedAlpha, targetW, targetH, {
    keepThreshold: 112,
    minForegroundAlpha: 232,
    rimOpaque: true
  });
}

function applyAlphaToImage(originalImg, finalAlpha) {
  decontaminateEdgeColors(originalImg, finalAlpha, {
    radius: 2,
    blendStrength: 0.72
  });

  for (let i = 0; i < finalAlpha.length; i += 1) {
    // Hard-binarise to 0 or 255. Reason: even with yuva444p, VP9's
    // in-loop filtering on the alpha channel can introduce sub-1
    // rounding errors (e.g. 254). With binary input the only surviving
    // translucent pixels are a hair-thin loop-filter halo, which the
    // rim solidification above already prevents from reaching the
    // desktop background. Going binary guarantees no 1/255 gap that
    // would let the blue desktop bleed through the cat's ear tip.
    const a = finalAlpha[i];
    originalImg.bitmap.data[i * 4 + 3] = a === 0 ? 0 : 255;
  }

  return originalImg;
}

async function matteJimpImage(originalImg) {
  const finalAlpha = await predictFinalAlphaForImage(originalImg);
  return applyAlphaToImage(originalImg, finalAlpha);
}

async function matteImageBuffer(inputBuffer) {
  const image = await Jimp.read(inputBuffer);
  const matted = await matteJimpImage(image);
  return matted.getBuffer("image/png");
}

async function mattingVideo(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error("输入视频不存在: " + inputPath);
  }

  const tempDir = path.join(process.cwd(), "public", "pet-videos", `temp_matting_${Date.now()}`);
  const ffmpegPath = resolveFfmpegPath();
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const tempDirPosix = tempDir.replace(/\\/g, "/");
    const inputPathPosix = inputPath.replace(/\\/g, "/");
    const outputPathPosix = outputPath.replace(/\\/g, "/");

    // 1. Extract frames
    const extRes = spawnSync(ffmpegPath, ["-i", inputPathPosix, "-vf", "fps=25", `${tempDirPosix}/%04d.png`], { stdio: "pipe" });
    if (extRes.error || extRes.status !== 0) {
      throw new Error(`FFmpeg extract error: ${extRes.stderr ? extRes.stderr.toString() : "Unknown error"}`);
    }
    const frames = fs.readdirSync(tempDir).filter(f => f.endsWith(".png")).sort();

    if (frames.length === 0) {
      throw new Error("未能从视频中提取出任何帧");
    }

    // 2. 先预测每一帧的 alpha，再把整段视频当成循环序列来稳定边缘。
    const alphaMasks = [];
    let frameWidth = 0;
    let frameHeight = 0;
    for (const frameName of frames) {
      const framePath = path.join(tempDir, frameName);
      const originalImg = await Jimp.read(framePath);
      frameWidth = originalImg.bitmap.width;
      frameHeight = originalImg.bitmap.height;
      const finalAlpha = await predictFinalAlphaForImage(originalImg);
      alphaMasks.push(finalAlpha);
    }

    const stabilisedMasks = stabiliseVideoAlphaMasks(alphaMasks, frameWidth, frameHeight);

    // 3. 把稳定后的 alpha 写回原始帧，同时清掉边缘脏色。
    for (let index = 0; index < frames.length; index += 1) {
      const framePath = path.join(tempDir, frames[index]);
      const originalImg = await Jimp.read(framePath);
      const mattedFrame = applyAlphaToImage(originalImg, stabilisedMasks[index]);
      await mattedFrame.write(framePath);
    }

    // 4. Encode back to webm with alpha. Three things matter here:
    //   -pix_fmt yuva444p  : full chroma resolution for alpha (no 4:2:0 halo)
    //   -lossless 1        : lossless VP9 → in-loop filtering disabled, so
    //                        alpha is encoded and decoded bit-exact. Without
    //                        this, the decoder can re-introduce translucent
    //                        pixels (e.g. A=1, A=254) even from binary input,
    //                        which causes the pink-halo bug on the desktop.
    //   -auto-alt-ref 0    : disable alt-ref frames for stable alpha.
    const encRes = spawnSync(ffmpegPath, ["-y", "-framerate", "25", "-i", `${tempDirPosix}/%04d.png`, "-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "yuva444p", "-auto-alt-ref", "0", outputPathPosix], { stdio: "pipe" });
    if (encRes.error || encRes.status !== 0) {
      throw new Error(`FFmpeg encode error: ${encRes.stderr ? encRes.stderr.toString() : "Unknown error"}`);
    }

  } catch (e) {
    if (e.stderr) {
      console.error("FFmpeg Error:", e.stderr.toString());
    }
    throw e;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return outputPath;
}

module.exports = {
  ensureRvmModel,
  resolveFfmpegPath,
  solidifyAlphaMask,
  matteImageBuffer,
  mattingVideo
};
