import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { requireUser } from "@/lib/server/guard";

export const runtime = "nodejs";

export const GET = route("GET", async (request) => {
  const user = await requireUser(request);
  return NextResponse.json(
    { user: { id: user.id, email: user.email, credits: user.credits } },
    { headers: { "Cache-Control": "no-store" } }
  );
});
