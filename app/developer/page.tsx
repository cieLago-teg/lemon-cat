"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/components/useSession";

type Overview = { users: number; pets: number; activeJobs: number; reviewJobs: number; worker: "ok" | "not_running"; provider: string; storage: string };

const cards: Array<{ key: keyof Pick<Overview, "users" | "pets" | "activeJobs" | "reviewJobs">; label: string; note: string; tone: string }> = [
  { key: "users", label: "注册用户", note: "累计账号数", tone: "bg-amber-100/70" },
  { key: "pets", label: "宠物档案", note: "已保存的档案", tone: "bg-emerald-100/70" },
  { key: "activeJobs", label: "处理中任务", note: "排队或模型处理中", tone: "bg-sky-100/70" },
  { key: "reviewJobs", label: "待人工核对", note: "不会自动重提", tone: "bg-rose-100/70" }
];

export default function DeveloperPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [devSession, setDevSession] = useState(false);
  const [starting, setStarting] = useState(true);

  const enterDeveloperMode = async (next = "/create") => {
    setError("");
    setStarting(true);
    try {
      const response = await fetch("/api/developer/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || `开发者模式启动失败 (${response.status})`);
      setDevSession(true);
      if (next !== "/developer") window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "开发者模式启动失败");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    void enterDeveloperMode("/developer");
    const controller = new AbortController();
    apiFetch("/api/developer/overview", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as Overview & { error?: string };
        if (!response.ok) throw new Error(data.error || `加载失败 (${response.status})`);
        setOverview(data);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setError(err instanceof Error ? err.message : "无法加载开发者后台");
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-storybook px-4 pb-16 pt-28">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-white/70 bg-paper-glass-strong px-7 py-8 shadow-[0_20px_50px_-30px_rgba(92,46,16,0.5)] sm:px-10">
          <p className="text-sm font-bold text-amber-700">DEVELOPER</p>
          <h1 className="mt-1 font-handwriting text-4xl text-[#5c2e10] sm:text-5xl">开发者后台</h1>
          <p className="mt-3 text-sm text-[#5c2e10]/70">本地开发专用入口：无需注册、邀请码或登录，可直接进入各个页面手动测试。</p>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {devSession ? "本地开发者会话已启用。" : "正在初始化本地开发者会话…"} 该入口只在 localhost / 127.0.0.1 存在，生产环境会自动关闭。
          </div>
          {error ? <p role="alert" className="mt-6 rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
          {!overview && !error ? <p className="mt-8 text-sm text-[#5c2e10]/65">正在读取服务状态…</p> : null}
          {overview ? <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => <article key={card.key} className={`rounded-2xl px-5 py-4 ${card.tone}`}><p className="text-xs font-bold text-[#5c2e10]/65">{card.label}</p><p className="mt-2 text-3xl font-bold text-[#5c2e10]">{overview[card.key]}</p><p className="mt-1 text-xs text-[#5c2e10]/60">{card.note}</p></article>)}
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-sm"><span className={`rounded-full px-4 py-2 font-bold ${overview.worker === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>Worker：{overview.worker === "ok" ? "运行中" : "未运行"}</span><span className="rounded-full bg-amber-100 px-4 py-2 text-amber-900">模型：{overview.provider}</span><span className="rounded-full bg-sky-100 px-4 py-2 text-sky-900">存储：{overview.storage}</span></div>
          </> : null}
          <div className="mt-8 border-t border-[#5c2e10]/10 pt-5">
            <h2 className="font-handwriting text-2xl font-bold text-[#5c2e10]">手动测试入口</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {[['/create', '开始创建'], ['/pets', '我的宠物'], ['/tasks', '生成任务'], ['/archive', '档案列表']].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-full bg-white/70 px-4 py-2 font-bold text-[#5c2e10] shadow-sm ring-1 ring-[#5c2e10]/10 hover:bg-white">{label}</Link>
              ))}
            </div>
            <button type="button" disabled={starting} onClick={() => void enterDeveloperMode("/create")} className="mt-4 rounded-full bg-[#5c2e10] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {starting ? "正在准备…" : "进入创建页（本地开发者）"}
            </button>
          </div>
          <div className="mt-8 border-t border-[#5c2e10]/10 pt-5"><Link href="/tasks" className="text-sm font-bold text-[#5c2e10] underline underline-offset-4">查看我的生成任务 →</Link></div>
        </div>
      </section>
    </main>
  );
}
