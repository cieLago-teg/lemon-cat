import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const archivesPath = path.join(rootDir, "data", "archives.json");
const outPath = path.join(rootDir, "desktop-pet-shell", "pet.png");
const configPath = path.join(rootDir, "desktop-pet-shell", "config.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function pickBestResult(results) {
  const priority = [
    { key: "贴纸", weight: 1 },
    { key: "像素", weight: 2 },
    { key: "水墨", weight: 3 },
    { key: "拼贴", weight: 4 }
  ];

  const scored = results
    .map((item) => {
      const style = String(item.style || "");
      const hit = priority.find((p) => style.includes(p.key));
      return { item, score: hit ? hit.weight : 999 };
    })
    .sort((a, b) => a.score - b.score);

  return scored[0]?.item ?? null;
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
}

function isPng(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);
    return header.toString("hex") === "89504e470d0a1a0a";
  } catch {
    return false;
  }
}

function getSourceImagePath(archive) {
  if (!archive?.id || !archive?.sourceImage?.ext) return null;
  const fileName = `${archive.id}.${archive.sourceImage.ext}`;
  const filePath = path.join(rootDir, "data", "archive-images", fileName);
  return fs.existsSync(filePath) ? filePath : null;
}

async function main() {
  if (!fs.existsSync(archivesPath)) {
    throw new Error("archives.json not found");
  }
  const archives = readJson(archivesPath);
  const first = Array.isArray(archives) ? archives.find((a) => Array.isArray(a.results) && a.results.length > 0) : null;
  if (!first) {
    throw new Error("no archive with results found");
  }

  const best = pickBestResult(first.results);
  if (!best?.imageUrl) {
    throw new Error("no usable result imageUrl");
  }

  try {
    await downloadToFile(best.imageUrl, outPath);
    if (!isPng(outPath)) {
      throw new Error("downloaded file is not a png");
    }
  } catch (e) {
    const fallback = getSourceImagePath(first);
    if (!fallback) throw e;
    fs.copyFileSync(fallback, outPath);
  }

  const nextConfig = { mode: "static", src: "pet.png" };
  writeJson(configPath, nextConfig);

  process.stdout.write(
    `Picked: petName=${first.petName} style=${best.style} -> ${path.relative(rootDir, outPath)}\n`
  );
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});
