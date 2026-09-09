import { NextResponse } from "next/server";
import { route } from "@/lib/server/http.cjs";
import { config } from "@/lib/server/config.cjs";
import { database, transaction } from "@/lib/server/db.cjs";
import { digest } from "@/lib/server/auth.cjs";
import { HttpError } from "@/lib/server/errors.cjs";
import crypto from "node:crypto";

export const runtime = "nodejs";

const DEVELOPER_EMAIL = "developer@lemoncat.local";

function assertLocalDeveloperMode() {
  const cfg = config();
  const hostname = new URL(cfg.origin).hostname;
  if (cfg.production || !["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new HttpError(404, "Not found");
  }
}

export const POST = route("POST", async () => {
  assertLocalDeveloperMode();
  const credits = Math.max(0, Number(process.env.DEVELOPER_INITIAL_CREDITS || 100));
  const user = await transaction(async (client) => {
    const { rows } = await client.query(
      "INSERT INTO users(id,email,password_hash,credits) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET credits=GREATEST(users.credits,EXCLUDED.credits) RETURNING id,email,credits",
      [crypto.randomUUID(), DEVELOPER_EMAIL, "local-developer-session", credits]
    );
    return rows[0];
  });
  const token = crypto.randomBytes(32).toString("hex");
  await database().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [digest(token), user.id]);
  return new NextResponse(JSON.stringify({ user, mode: "local-developer" }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "set-cookie": `lemon_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800` }
  });
});
