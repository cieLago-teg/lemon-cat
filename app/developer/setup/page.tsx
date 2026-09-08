"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Strength = { label: "低" | "中" | "高"; score: 1 | 2 | 3; hint: string };

function passwordStrength(value: string): Strength | null {
  if (!value) return null;
  const types = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(value)).length;
  if (value.length < 8) return { label: "低", score: 1, hint: "至少 8 位后才能保存" };
  if (value.length >= 12 && types >= 3) return { label: "高", score: 3, hint: "长度和组合都很好" };
  if (types >= 2) return { label: "中", score: 2, hint: "再加长一些或混合更多字符会更稳妥" };
  return { label: "低", score: 1, hint: "建议混合字母、数字或符号" };
}

export default function DeveloperSetupPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const strength = passwordStrength(password);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/developer/bootstrap", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return setAvailable(false);
        const data = (await response.json()) as { available?: boolean };
        setAvailable(data.available === true);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setError("无法确认初始化状态，请检查本机服务和数据库");
      });
    return () => controller.abort();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("请输入有效邮箱");
    if (password.length < 8 || password.length > 128) return setError("密码需要 8—128 位");
    setSubmitting(true);
    try {
      const response = await fetch("/api/developer/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const data = (await response.json().catch(() => ({}))) as { user?: unknown; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "初始化失败");
      window.location.href = "/developer";
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常，请稍后重试");
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas-watercolor px-4 py-16">
      <div className="w-full max-w-md bg-paper-glass-strong rounded-[2rem] border border-white/60 px-8 py-10 shadow-[0_25px_60px_-30px_rgba(92,46,16,0.5)] ring-1 ring-black/5 backdrop-blur-xl sm:px-10">
        <div className="text-center">
          <div className="text-4xl" aria-hidden>🛠️</div>
          <h1 className="mt-3 font-handwriting text-4xl leading-none text-[#5c2e10] sm:text-5xl">初始化开发者账号</h1>
          <p className="mt-3 text-sm text-[#5c2e10]/70">仅在本机、且尚无管理员时可执行一次。</p>
        </div>

        {available === false ? (
          <div className="mt-8 rounded-2xl bg-amber-100/70 px-5 py-4 text-sm text-amber-950">
            <p className="font-bold">管理员账号已存在，或这里不是本机服务。</p>
            <Link href="/login" className="mt-2 inline-block font-bold underline underline-offset-2">返回登录</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">开发者邮箱</span>
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none transition placeholder:text-[#5c2e10]/35 focus:border-[#f8a8a8] focus:bg-white/90 focus:ring-2 focus:ring-[#f8a8a8]/40" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">密码 <span className="font-normal text-[#5c2e10]/50">（至少 8 位）</span></span>
              <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none transition placeholder:text-[#5c2e10]/35 focus:border-[#f8a8a8] focus:bg-white/90 focus:ring-2 focus:ring-[#f8a8a8]/40" />
              {strength ? <div aria-live="polite" className="mt-2 flex items-center gap-2 text-xs text-[#5c2e10]/65"><span className="flex gap-1" aria-hidden>{[1, 2, 3].map((segment) => <span key={segment} className={`h-1.5 w-7 rounded-full ${segment <= strength.score ? strength.score === 3 ? "bg-emerald-500" : strength.score === 2 ? "bg-amber-500" : "bg-rose-400" : "bg-[#5c2e10]/10"}`} />)}</span><span>密码强度：{strength.label} · {strength.hint}</span></div> : null}
            </label>
            {error ? <p role="alert" className="rounded-xl bg-[#f8a8a8]/25 px-4 py-2.5 text-xs text-[#a33434]">{error}</p> : null}
            <button type="submit" disabled={available !== true || submitting} className="w-full rounded-full bg-[#f8a8a8]/85 px-6 py-3 font-handwriting text-xl text-white shadow-[0_10px_25px_-12px_rgba(163,52,52,0.6)] transition hover:bg-[#f8a8a8] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "正在初始化…" : available === null ? "正在确认状态…" : "创建并进入后台"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
