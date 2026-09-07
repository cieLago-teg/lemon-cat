import { NextResponse } from "next/server";
import { getAllArchives, saveArchiveAsync, SaveArchiveInput } from "@/lib/db/archive";
import { route } from "@/lib/server/http.cjs";

export const runtime = "nodejs";

export const GET = route("GET", async () => {
  const archives = getAllArchives();
  return NextResponse.json({ archives });
});

export const POST = route("POST", async (request) => {
  const body = (await request.json()) as SaveArchiveInput;

  if (!body.petName) {
    return NextResponse.json({ error: "宠物名字不能为空" }, { status: 400 });
  }

  // 2026-06-04：用 saveArchiveAsync 把 results[].imageUrl 从 OSS
  // 下载到 data/archive-images/，落盘时换成 /api/archive/image/... 本地路径，
  // 浏览器后续秒加载，绕开手机热点 DoH 22s DNS 慢的问题。
  const newArchive = await saveArchiveAsync(body);
  return NextResponse.json({ archive: newArchive });
});
