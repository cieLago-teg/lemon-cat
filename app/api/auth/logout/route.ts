import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { logout, sameOrigin } from "@/lib/server/auth.cjs";

export const runtime = "nodejs";

export const POST = route("POST", async (request) => {
  sameOrigin(request);
  const cookie = await logout(request);
  return NextResponse.json({ ok: true }, { headers: { "set-cookie": cookie } });
});
