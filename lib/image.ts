const MAX_SIZE = 2 * 1024 * 1024;

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
  let scale = 1;
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
    scale = Math.max(0.45, scale - 0.1);
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
