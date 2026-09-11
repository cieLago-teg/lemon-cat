import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { authenticate, sameOrigin } from "@/lib/server/auth.cjs";
import { publicRegistration, requestAccountLink } from '@/lib/server/accounts.cjs';

export const runtime = "nodejs";

export const POST = route("POST", async (request) => {
  sameOrigin(request);
  const body = (await request.json()) as Record<string, unknown>;
  if (publicRegistration()) return NextResponse.json(await requestAccountLink(body, 'verify'), { status: 202 });
  const { user, cookie } = await authenticate(body, true);
  return NextResponse.json(
    { user: { id: user.id, email: user.email, credits: user.credits } },
    { headers: { "set-cookie": cookie } }
  );
});
