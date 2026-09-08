"use client";

import { useState } from "react";
import { apiFetch } from "@/app/components/useSession";

// 2026-09-08 1A 用户隔离：登录/注册页。
// 登录成功后整页跳转（window.location），让 AppNav 重新拉取会话。
export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const safeNext = () => {
    if (typeof window === "undefined") return "/create";
    const next = new URLSearchParams(window.location.search).get("next") || "/create";
    // 只接受站内路径，防 open redirect。
    return next.startsWith("/") && !next.startsWith("//") ? next : "/create";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("请输入有效邮箱");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("密码需要 12—128 位");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password })
      });
      const data = (await res.json().catch(() => ({}))) as { user?: unknown; error?: string };
      if (!res.ok || !data.user) {
        throw new Error(data.error || (mode === "login" ? "登录失败" : "注册失败"));
      }
      window.location.href = safeNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常，请稍后再试");
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas-watercolor px-4 py-16">
      <div className="w-full max-w-md">
        <div className="bg-paper-glass-strong rounded-[2rem] border border-white/60 px-8 py-10 shadow-[0_25px_60px_-30px_rgba(92,46,16,0.5)] ring-1 ring-black/5 backdrop-blur-xl sm:px-10">
          <div className="text-center">
            <div className="text-4xl" aria-hidden>
              🍋
            </div>
            <h1 className="mt-3 font-handwriting text-4xl leading-none text-[#5c2e10] sm:text-5xl">
              {isLogin ? "欢迎回来" : "加入柠檬树苗"}
            </h1>
            <p className="mt-3 text-sm text-[#5c2e10]/70">
              {isLogin ? "你的宠物们还在等你哦" : "给毛孩子建一份永远的数字档案"}
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">邮箱</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none transition placeholder:text-[#5c2e10]/35 focus:border-[#f8a8a8] focus:bg-white/90 focus:ring-2 focus:ring-[#f8a8a8]/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">
                密码 <span className="font-normal text-[#5c2e10]/50">（12 位以上）</span>
              </span>
              <input
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 12 位"
                className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none transition placeholder:text-[#5c2e10]/35 focus:border-[#f8a8a8] focus:bg-white/90 focus:ring-2 focus:ring-[#f8a8a8]/40"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl bg-[#f8a8a8]/25 px-4 py-2.5 text-xs text-[#a33434]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-[#f8a8a8]/85 px-6 py-3 font-handwriting text-xl text-white shadow-[0_10px_25px_-12px_rgba(163,52,52,0.6)] transition hover:bg-[#f8a8a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "请稍等…" : isLogin ? "登录" : "创建账号"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#5c2e10]/70">
            {isLogin ? "还没有账号？" : "已经有账号了？"}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setError("");
              }}
              className="ml-1 font-bold text-[#5c2e10] underline-offset-2 hover:underline"
            >
              {isLogin ? "去注册" : "去登录"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
