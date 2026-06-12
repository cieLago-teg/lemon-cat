import { NextResponse } from "next/server";
import { getAllArchives, saveArchiveAsync, SaveArchiveInput } from "@/lib/db/archive";

export async function GET() {
  try {
    const archives = getAllArchives();
    return NextResponse.json({ archives });
  } catch {
    return NextResponse.json({ error: "Failed to fetch archives" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveArchiveInput;

    if (!body.petName) {
      return NextResponse.json({ error: "宠物名字不能为空" }, { status: 400 });
    }

    // 2026-06-04：用 saveArchiveAsync 把 results[].imageUrl 从 OSS
    // 下载到 data/archive-images/，落盘时换成 /api/archive/image/... 本地路径，
    // 浏览器后续秒加载，绕开手机热点 DoH 22s DNS 慢的问题。
    const newArchive = await saveArchiveAsync(body);
    return NextResponse.json({ archive: newArchive });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save archive" },
      { status: 500 }
    );
  }
}
