import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

// 2026-06-09 商业化减法：桌面 App 状态查询。
// 给 /companion 页的"桌面 App 状态卡"用。
// 判定标准（轻量、零外部依赖）：
//   ready = desktop-pet-shell/node_modules/electron 存在
// 这样用户点"下载桌面 App"前不会一直显示 not_found 的焦虑。
export async function GET() {
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
}
