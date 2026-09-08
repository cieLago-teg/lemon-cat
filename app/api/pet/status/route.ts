import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

// 2026-06-09 商业化减法：桌面 App 状态查询。
// 给 /companion 页的"桌面 App 状态卡"用。
// 判定标准（轻量、零外部依赖）：
//   ready = desktop-pet-shell/node_modules/electron 存在
// 这样用户点"下载桌面 App"前不会一直显示 not_found 的焦虑。
export const GET = route("GET", async (request) => {
  // 2026-09-08 1A 用户隔离：所有 /api/* 统一要求登录（/health 除外）。
  await requireUser(request);
  const shellDir = path.join(process.cwd(), "desktop-pet-shell");
  const electronExeWin = path.join(shellDir, "node_modules", "electron", "dist", "electron.exe");
  const electronCli = path.join(shellDir, "node_modules", "electron", "cli.js");

  const installed =
    fs.existsSync(electronExeWin) || fs.existsSync(electronCli);

  return NextResponse.json(
    { ready: installed },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
});
