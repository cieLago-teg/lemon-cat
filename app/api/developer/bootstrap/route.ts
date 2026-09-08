import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { bootstrapDeveloper, canBootstrapDeveloper } from "@/lib/server/auth.cjs";
import { database } from "@/lib/server/db.cjs";
import { HttpError } from "@/lib/server/errors.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 只给首次本机开发者展示初始化入口；公网环境直接伪装为不存在。
export const GET = route("GET", async () => {
  if (!canBootstrapDeveloper()) throw new HttpError(404, "Not found");
  const { rowCount } = await database().query("SELECT 1 FROM users WHERE is_admin=true LIMIT 1");
  return NextResponse.json({ available: !rowCount });
});

export const POST = route("POST", async (request) => {
  const body = (await request.json()) as Record<string, unknown>;
  const { user, cookie } = await bootstrapDeveloper(body);
  return NextResponse.json(
    { user: { id: user.id, email: user.email, credits: user.credits, isAdmin: user.isAdmin } },
    { headers: { "set-cookie": cookie } }
  );
});
