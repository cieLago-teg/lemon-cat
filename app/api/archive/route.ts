import { NextResponse } from "next/server";
import { getAllArchives, saveArchiveAsync, SaveArchiveInput } from "@/lib/db/archive";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

export const runtime = "nodejs";

export const GET = route("GET", async (request) => {
  // 2026-09-08 1A 用户隔离：只返回当前登录用户自己的档案。
  const user = await requireUser(request);
  const archives = getAllArchives().filter((a) => a.ownerId === user.id);
  return NextResponse.json({ archives });
});

export const POST = route("POST", async (request) => {
  const user = await requireUser(request);
  const body = (await request.json()) as SaveArchiveInput;

  if (!body.petName) {
    return NextResponse.json({ error: "宠物名字不能为空" }, { status: 400 });
  }

  // 2026-06-04：用 saveArchiveAsync 把 results[].imageUrl 从 OSS
  // 下载到 data/archive-images/，落盘时换成 /api/archive/image/... 本地路径，
  // 浏览器后续秒加载，绕开手机热点 DoH 22s DNS 慢的问题。
  // 2026-09-08：归属强制取服务端登录态，忽略客户端传入的 ownerId。
  const newArchive = await saveArchiveAsync({ ...body, ownerId: user.id });
  return NextResponse.json({ archive: newArchive });
});
