import fs from "fs";
import { getArchiveById, getSourceImageFilePath } from "@/lib/db/archive";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-z]+$/i.test(id)) {
    return new Response("Invalid id", { status: 400 });
  }
  const archive = getArchiveById(id);
  if (!archive?.sourceImage) {
    return new Response("Not found", { status: 404 });
  }
  const filePath = getSourceImageFilePath(id, archive.sourceImage.ext);
  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const buf = fs.readFileSync(filePath);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": archive.sourceImage.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

