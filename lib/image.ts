const MAX_SIZE = 2 * 1024 * 1024;
import { pixelQuality } from './image-quality.cjs';

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("图片读取失败"));
    };
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("图片压缩失败"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("编码失败"));
        return;
      }
      const base64 = reader.result.split(",")[1];
      if (!base64) {
        reject(new Error("编码失败"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("编码失败"));
    reader.readAsDataURL(blob);
  });
}

export async function compressToBase64(file: File) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("浏览器不支持 Canvas");
  }
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  let scale = Math.min(1, 2048 / Math.max(image.width, image.height));
  let quality = outputType === "image/png" ? 0.92 : 0.85;
  let blob: Blob | null = null;
  const MIN_DIM = 10;
  for (let i = 0; i < 8; i += 1) {
    const targetW = Math.max(MIN_DIM, Math.floor(image.width * scale));
    const targetH = Math.max(MIN_DIM, Math.floor(image.height * scale));
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, targetW, targetH);
    blob = await canvasToBlob(canvas, outputType, quality);
    if (blob.size <= MAX_SIZE) {
      break;
    }
    quality = Math.max(0.5, quality - 0.08);
    scale *= 0.8;
  }
  if (!blob) {
    throw new Error("图片压缩失败");
  }
  if (blob.size > MAX_SIZE) {
    throw new Error("压缩后仍超过2MB，请更换图片");
  }
  const imageBase64 = await blobToBase64(blob);
  return {
    imageBase64,
    mimeType: outputType,
    size: blob.size
  };
}

export type CropBox = { x: number; y: number; width: number; height: number };
export async function preparePhoto(file: File, crop: CropBox, turns: number, exposure: number) {
  const image = await loadImage(file);
  const rotated = document.createElement('canvas');
  const quarter = ((turns % 4) + 4) % 4;
  const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
  const w = Math.round(image.width * scale), h = Math.round(image.height * scale);
  rotated.width = quarter % 2 ? h : w; rotated.height = quarter % 2 ? w : h;
  const rc = rotated.getContext('2d');
  if (!rc) throw new Error('浏览器无法处理照片');
  rc.translate(rotated.width / 2, rotated.height / 2); rc.rotate(quarter * Math.PI / 2);
  rc.drawImage(image, -w / 2, -h / 2, w, h);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(rotated.width * crop.width)); output.height = Math.max(1, Math.round(rotated.height * crop.height));
  if (Math.min(output.width, output.height) < 32) throw new Error('框选区域太小，请扩大到完整宠物');
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('浏览器无法处理照片');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, output.width, output.height);
  ctx.filter = `brightness(${1 + exposure / 100})`;
  ctx.drawImage(rotated, crop.x * rotated.width, crop.y * rotated.height, crop.width * rotated.width, crop.height * rotated.height, 0, 0, output.width, output.height);
  const sample = document.createElement('canvas'); sample.width = 128; sample.height = Math.max(1, Math.round(128 * output.height / output.width));
  const sc = sample.getContext('2d');
  if (!sc) throw new Error('浏览器无法读取照片');
  sc.drawImage(output, 0, 0, sample.width, sample.height);
  const quality = pixelQuality(sc.getImageData(0, 0, sample.width, sample.height).data, sample.width, sample.height);
  if (Math.min(output.width, output.height) < 384) quality.warnings.unshift('分辨率偏低，建议选择更清晰的原图');
  const blob = await canvasToBlob(output, 'image/jpeg', 0.95);
  return { file: new File([blob], 'prepared-pet.jpg', { type: 'image/jpeg' }), warnings: quality.warnings, width: output.width, height: output.height };
}
