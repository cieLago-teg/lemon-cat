"use client";

import { useEffect, useState } from "react";
import { safeReturnPath } from "@/lib/client/navigation.cjs";
import { useLocale } from '@/app/components/LocaleProvider';
import { authError, type MessageKey } from '@/lib/i18n';

type PasswordStrength = { label: MessageKey; score: 1 | 2 | 3; hint: MessageKey };

function passwordStrength(value: string): PasswordStrength | null {
  if (!value) return null;
  const types = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(value)).length;
  if (value.length < 8) return { label: "low", score: 1, hint: "tooShort" };
  if (value.length >= 12 && types >= 3) return { label: "high", score: 3, hint: "strongHint" };
  if (types >= 2) return { label: "medium", score: 2, hint: "mediumHint" };
  return { label: "low", score: 1, hint: "weakHint" };
}

// 2026-09-08 1A 用户隔离：登录/注册页。
// 登录成功后整页跳转（window.location），让 AppNav 重新拉取会话。
export default function LoginPage() {
  const { locale, t } = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ key: MessageKey; status?: number; serverMessage?: string } | null>(null);
  const [localDeveloper, setLocalDeveloper] = useState(false);
  const [developerStarting, setDeveloperStarting] = useState(false);
  const [publicSignup, setPublicSignup] = useState<boolean | null>(null);
  const [mailSent, setMailSent] = useState(false);
  const [recovery, setRecovery] = useState(false);

  const enterLocalDeveloper = async () => {
    setDeveloperStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/developer/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error(`Local developer session failed (${response.status})`);
      window.location.href = safeNext();
    } catch (err) {
      console.error('[login] developer session failed', err);
      setError({ key: 'localFailed' });
      setDeveloperStarting(false);
    }
  };

  useEffect(() => {
    setLocalDeveloper(["localhost", "127.0.0.1"].includes(window.location.hostname));
    const controller = new AbortController();
    fetch('/api/auth/options', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Auth options HTTP ${response.status}`);
      setPublicSignup((await response.json()).publicRegistration === true);
    }).catch((err) => {
      if (controller.signal.aborted) return;
      console.error('[login] options failed', err);
      setError({ key: 'authOptionsFailed' });
    });
    return () => controller.abort();
  }, []);

  const safeNext = () => {
    if (typeof window === "undefined") return "/create";
    const next = new URLSearchParams(window.location.search).get("next") || "/create";
    // 只接受站内路径，防 open redirect。
    return safeReturnPath(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setMailSent(false);

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError({ key: 'invalidEmail' });
      return;
    }
    if (!recovery && !(mode === 'register' && publicSignup) && (password.length < 8 || password.length > 128)) {
      setError({ key: 'passwordRange' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${recovery ? 'recovery' : mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, locale, ...(!recovery && !(mode === 'register' && publicSignup) ? { password } : {}), ...(mode === "register" && !publicSignup ? { inviteCode: inviteCode.trim() } : {}) })
      });
      const data = (await res.json()) as { user?: unknown; error?: string; sent?: boolean };
      if (res.status === 202 && data.sent) { setMailSent(true); setSubmitting(false); return; }
      if (!res.ok || !data.user) {
        setError({ key: 'authFailed', status: res.status, serverMessage: data.error });
        setSubmitting(false);
        return;
      }
      window.location.href = safeNext();
    } catch (err) {
      console.error('[login] request failed', err);
      setError({ key: 'networkFailed' });
      setSubmitting(false);
    }
  };

  const isLogin = mode === "login";
  const strength = isLogin ? null : passwordStrength(password);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-canvas-watercolor px-4 py-16">
      <div className="w-full max-w-md">
        <div className="bg-paper-glass-strong rounded-[2rem] border border-white/60 px-8 py-10 shadow-[0_25px_60px_-30px_rgba(92,46,16,0.5)] ring-1 ring-black/5 backdrop-blur-xl sm:px-10">
          <div className="text-center">
            <div className="text-4xl" aria-hidden>
              🐾
            </div>
            <h1 className="mt-3 font-handwriting text-4xl leading-none text-[#5c2e10] sm:text-5xl">
              {t(isLogin ? 'welcome' : 'publicJoin')}
            </h1>
            <p className="mt-3 text-sm text-[#5c2e10]/70">
              {t(isLogin ? 'welcomeHint' : publicSignup ? 'publicJoinHint' : 'joinHint')}
            </p>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">{t('email')}</span>
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

            {!recovery && !(mode === 'register' && publicSignup) && <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">
                {t('password')} <span className="font-normal text-[#5c2e10]/50">({t('passwordMin')})</span>
              </span>
              <input
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordMin')}
                className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none transition placeholder:text-[#5c2e10]/35 focus:border-[#f8a8a8] focus:bg-white/90 focus:ring-2 focus:ring-[#f8a8a8]/40"
              />
              {strength && (
                <div aria-live="polite" className="mt-2 flex items-center gap-2 text-xs text-[#5c2e10]/65">
                  <span className="flex gap-1" aria-hidden>
                    {[1, 2, 3].map((segment) => (
                      <span key={segment} className={`h-1.5 w-7 rounded-full ${segment <= strength.score ? strength.score === 3 ? "bg-emerald-500" : strength.score === 2 ? "bg-amber-500" : "bg-rose-400" : "bg-[#5c2e10]/10"}`} />
                    ))}
                  </span>
                  <span>{t('strength')}: {t(strength.label)} · {t(strength.hint)}</span>
                </div>
              )}
            </label>}

            {!isLogin && publicSignup === false && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#5c2e10]/80">{t('invite')}</span>
                <input type="password" autoComplete="off" required value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)} placeholder={t('inviteHint')}
                  className="w-full rounded-2xl border border-[#5c2e10]/20 bg-white/70 px-4 py-3 text-sm text-[#5c2e10] outline-none focus:border-[#f8a8a8]" />
              </label>
            )}

            {error ? (
              <p role="alert" className="rounded-xl bg-[#f8a8a8]/25 px-4 py-2.5 text-xs text-[#a33434]">
                {error.status ? authError(locale, error.status, error.serverMessage) : t(error.key)}
              </p>
            ) : null}
            {mailSent && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{t('mailSent')}</p>}

            <button
              type="submit"
              disabled={submitting || publicSignup === null}
              className="w-full rounded-full bg-[#f8a8a8]/85 px-6 py-3 font-handwriting text-xl text-white shadow-[0_10px_25px_-12px_rgba(163,52,52,0.6)] transition hover:bg-[#f8a8a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t(submitting ? 'waiting' : recovery ? 'sendReset' : isLogin ? 'login' : publicSignup ? 'sendLink' : 'createAccount')}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#5c2e10]/70">
            {t(isLogin ? 'noAccount' : 'hasAccount')}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? "register" : "login");
                setRecovery(false); setMailSent(false);
                setError(null);
              }}
              className="ml-1 font-bold text-[#5c2e10] underline-offset-2 hover:underline"
            >
              {t(isLogin ? 'register' : 'goLogin')}
            </button>
          </p>
          {publicSignup && <button type="button" className="mt-4 w-full text-center text-xs underline" onClick={() => { setRecovery(!recovery); setMode('login'); setMailSent(false); setError(null); }}>{t(recovery ? 'goLogin' : 'forgotPassword')}</button>}
          {localDeveloper ? (
            <div className="mt-6 border-t border-[#5c2e10]/10 pt-5 text-center">
              <button type="button" onClick={() => void enterLocalDeveloper()} disabled={developerStarting} className="text-xs font-bold text-amber-800 underline underline-offset-4 disabled:opacity-60">
                {t(developerStarting ? 'localStarting' : 'localEntry')}
              </button>
              <p className="mt-1 text-[11px] text-[#5c2e10]/50">{t('localOnly')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
