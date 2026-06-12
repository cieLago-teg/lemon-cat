const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveFfmpegPath,
  solidifyAlphaMask,
  mattingVideo,
} = require("./rvm-matting.js");

test("resolveFfmpegPath returns an existing executable path", () => {
  const resolvedPath = resolveFfmpegPath();
  assert.ok(resolvedPath.endsWith(".exe") || resolvedPath.endsWith("ffmpeg"));
});

test("resolveFfmpegPath skips non-executable candidates", () => {
  const resolvedPath = resolveFfmpegPath({
    candidates: ["D:/bad/ffmpeg.exe", "D:/good/ffmpeg.exe"],
    isExecutable: (candidate) => candidate.includes("/good/")
  });

  assert.equal(resolvedPath, "D:/good/ffmpeg.exe");
});

test("solidifyAlphaMask fills enclosed holes but keeps edge-connected background transparent", () => {
  const width = 5;
  const height = 5;
  const alpha = Uint8Array.from([
    0, 0, 0, 0, 0,
    0, 255, 255, 255, 0,
    0, 255, 0, 255, 0,
    0, 255, 255, 255, 0,
    0, 0, 0, 0, 0
  ]);

  const refined = solidifyAlphaMask(alpha, width, height, {
    keepThreshold: 128,
    minForegroundAlpha: 220
  });

  assert.equal(refined[2 + 2 * width], 255);
  assert.equal(refined[0], 0);
  assert.equal(refined[4], 0);
  assert.equal(refined[20], 0);
  assert.equal(refined[24], 0);
});

test("solidifyAlphaMask seals tiny diagonal leaks so interior does not get cut out", () => {
  const width = 5;
  const height = 5;
  const alpha = Uint8Array.from([
    0, 0, 0, 0, 0,
    0, 255, 255, 255, 0,
    0, 255, 0, 255, 0,
    0, 255, 0, 255, 0,
    0, 0, 0, 0, 0
  ]);

  const refined = solidifyAlphaMask(alpha, width, height, {
    keepThreshold: 128,
    minForegroundAlpha: 220
  });

  assert.equal(refined[2 + 2 * width], 255);
});

test("solidifyAlphaMask solidifies the outer rim so subject-adjacent translucent pixels become opaque", () => {
  // 10x6: subject is a 4x4 block of 255 at columns 4..7, rows 1..4.
  // Around it we leave a ring of *softly translucent* alpha values that are
  // not bright enough to be classified as "foreground" by the keepThreshold.
  // After solidifyAlphaMask, the rim pixels must still end up opaque because
  // they are subject-adjacent (otherwise the blue background will bleed
  // through the 1/255 semi-transparent gap and produce a pink halo on cat
  // ears).
  const width = 10;
  const height = 6;
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = x >= 4 && x <= 7 && y >= 1 && y <= 4;
      const oneStep = !inside && x >= 3 && x <= 8 && y >= 0 && y <= 5;
      alpha[y * width + x] = inside ? 255 : oneStep ? 200 : 0;
    }
  }

  const refined = solidifyAlphaMask(alpha, width, height, {
    keepThreshold: 128,
    minForegroundAlpha: 255,
    rimOpaque: true
  });

  // The interior (true subject) must stay opaque.
  for (let y = 1; y <= 4; y += 1) {
    for (let x = 4; x <= 7; x += 1) {
      assert.equal(refined[y * width + x], 255, `interior ${x},${y} should be 255`);
    }
  }
  // The 1-step soft rim must be solidified to 255 because it is 4-connected
  // to the subject, otherwise the blue background will show through.
  for (let y = 0; y <= 5; y += 1) {
    for (let x = 3; x <= 8; x += 1) {
      const inside = x >= 4 && x <= 7 && y >= 1 && y <= 4;
      if (inside) continue;
      assert.equal(refined[y * width + x], 255, `rim ${x},${y} should be 255 (was ${refined[y * width + x]})`);
    }
  }
  // The background that is *not* adjacent to the subject must stay transparent.
  assert.equal(refined[0], 0);
  assert.equal(refined[width - 1], 0);
  assert.equal(refined[(height - 1) * width], 0);
  assert.equal(refined[height * width - 1], 0);
});

test("mattingVideo throws error if input video does not exist", async () => {
  await assert.rejects(
    () => mattingVideo("not-exist.mp4", "out.webm"),
    /输入视频不存在/
  );
});

test("mattingVideo end-to-end: produced webm has no surviving translucent rim pixels after decode", async () => {
  // Build a 4-frame synthetic RGBA sequence whose frame 0 contains a
  // foreground square surrounded by alpha=200 (a "soft" rim that the keep
  // threshold alone would leave translucent). If the encoder dropped chroma
  // resolution (yuva420p), the rim would survive as A=254 in the decoded
  // output, which is exactly the bug we are fixing.
  const ffmpegPath = require("node:child_process").execSync("node -e \"const {resolveFfmpegPath}=require('./lib/pet/rvm-matting.js'); process.stdout.write(resolveFfmpegPath())\"").toString();
  const { spawnSync } = require("node:child_process");
  const path = require("node:path");
  const fs = require("node:fs");
  const os = require("node:os");
  const { Jimp } = require("jimp");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "matte-e2e-"));
  const width = 64;
  const height = 64;
  for (let f = 0; f < 4; f += 1) {
    const img = new Jimp({ width, height, color: 0x00000000 });
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inside = x >= 24 && x <= 39 && y >= 24 && y <= 39;
        const rim = !inside && x >= 22 && x <= 41 && y >= 22 && y <= 41;
        const a = inside ? 255 : rim ? 200 : 0;
        const color = (255 << 24) | (200 << 16) | (200 << 8) | a;
        img.setPixelColor(color >>> 0, x, y);
      }
    }
    await img.write(path.join(tmp, String(f + 1).padStart(4, "0") + ".png"));
  }

  const inputMp4 = path.join(tmp, "src.mp4");
  const r1 = spawnSync(ffmpegPath, ["-y", "-framerate", "25", "-i", path.join(tmp, "%04d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", inputMp4], { stdio: "pipe" });
  assert.equal(r1.status, 0, `mp4-encode failed: ${r1.stderr?.toString().slice(-300)}`);

  const outWebm = path.join(tmp, "out.webm");
  const ok = await mattingVideo(inputMp4, outWebm);
  assert.equal(ok, outWebm);

  const dec = path.join(tmp, "frame0.png");
  const r2 = spawnSync(ffmpegPath, ["-y", "-c:v", "libvpx-vp9", "-i", outWebm, "-frames:v", "1", "-vf", "format=rgba", dec], { stdio: "pipe" });
  assert.equal(r2.status, 0, `decode failed: ${r2.stderr?.toString().slice(-300)}`);

  const decoded = await Jimp.read(dec);
  let translucent254 = 0;
  for (let i = 0; i < decoded.bitmap.data.length; i += 4) {
    if (decoded.bitmap.data[i + 3] === 254) translucent254 += 1;
  }
  assert.equal(translucent254, 0, `decoded frame should not contain A=254 pixels (the pink-halo bug), got ${translucent254}`);
});

test("mattingVideo: encoder uses yuva444p (alpha at full chroma resolution)", () => {
  // The matting pipeline must call ffmpeg with -pix_fmt yuva444p so that
  // alpha edges are not subsampled; otherwise a real 1/255 semi-transparent
  // edge from the model can survive 4:2:0 and become a visible halo on the
  // desktop. We assert the exact encoder call by inspecting the source code
  // for the -pix_fmt argument. This is a robust regression: if someone later
  // "optimises" it back to yuva420p, this test will fail loudly.
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname, "rvm-matting.js"), "utf8");
  // Find the line that actually contains -pix_fmt as a flag (i.e. as a
  // quoted standalone token, not in a comment), and check the value.
  const lines = source.split(/\r?\n/);
  let found = false;
  let value = null;
  for (const line of lines) {
    const code = line.replace(/\/\/.*$/, "");
    if (!code.includes("-pix_fmt")) continue;
    const tokens = code.split(/[",\s]+/).filter(Boolean);
    const idx = tokens.indexOf("-pix_fmt");
    if (idx >= 0) {
      value = tokens[idx + 1];
      found = true;
      break;
    }
  }
  assert.ok(found, "mattingVideo must set a -pix_fmt on the encoder call");
  assert.equal(value, "yuva444p", `encoder pix_fmt must be yuva444p, got: ${value}`);
});

test("mattingVideo: decoded alpha is either 0 or 255 (no surviving translucent pixels)", async () => {
  // Round-trip a 128x128 binary-alpha frame through mattingVideo. After
  // decode, every alpha must be 0 (background) or 255 (subject). If any
  // pixel is in (0, 255), it means the alpha channel is being filtered /
  // subsampled by the encoder, which is exactly the pink-halo bug.
  const { spawnSync } = require("node:child_process");
  const path = require("node:path");
  const fs = require("node:fs");
  const os = require("node:os");
  const ffmpegPath = require("node:child_process")
    .execSync("node -e \"const {resolveFfmpegPath}=require('./lib/pet/rvm-matting.js'); process.stdout.write(resolveFfmpegPath())\"")
    .toString();
  const { Jimp } = require("jimp");
  const { mattingVideo } = require("./rvm-matting.js");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "matte-binalpha-"));
  const W = 128;
  const H = 128;
  for (let f = 1; f <= 4; f += 1) {
    const img = new Jimp({ width: W, height: H, color: 0x00000000 });
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const inside = x >= 32 && x <= 95 && y >= 32 && y <= 95;
        const a = inside ? 255 : 0;
        const color = (255 << 24) | (240 << 16) | (200 << 8) | a;
        img.setPixelColor(color >>> 0, x, y);
      }
    }
    await img.write(path.join(tmp, String(f).padStart(4, "0") + ".png"));
  }
  const inputMp4 = path.join(tmp, "src.webm");
  const r1 = spawnSync(ffmpegPath, ["-y", "-framerate", "25", "-i", path.join(tmp, "%04d.png"), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", inputMp4], { stdio: "pipe" });
  assert.equal(r1.status, 0, `src encode failed: ${r1.stderr?.toString().slice(-200)}`);

  const outWebm = path.join(tmp, "out.webm");
  await mattingVideo(inputMp4, outWebm);

  const dec = path.join(tmp, "f0.png");
  const r2 = spawnSync(ffmpegPath, ["-y", "-c:v", "libvpx-vp9", "-i", outWebm, "-frames:v", "1", "-vf", "format=rgba", dec], { stdio: "pipe" });
  assert.equal(r2.status, 0, `decode failed: ${r2.stderr?.toString().slice(-200)}`);

  const decoded = await Jimp.read(dec);
  let translucent = 0;
  const histo = new Map();
  for (let i = 0; i < decoded.bitmap.data.length; i += 4) {
    const a = decoded.bitmap.data[i + 3];
    if (a > 0 && a < 255) {
      translucent += 1;
      const r = decoded.bitmap.data[i];
      const g = decoded.bitmap.data[i + 1];
      const b = decoded.bitmap.data[i + 2];
      const k = `${r}_${g}_${b}_${a}`;
      histo.set(k, (histo.get(k) || 0) + 1);
    }
  }
  const top = [...histo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  assert.equal(translucent, 0, `decoded frame should be strictly binary alpha (0 or 255), got ${translucent} translucent pixels; top: ${JSON.stringify(top)}`);
});
