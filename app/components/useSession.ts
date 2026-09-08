"use client";

import { useEffect, useState } from "react";

// 2026-09-08 1A 用户隔离：前端登录态与 401 引导。
export type SessionUser = {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
};

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { user?: SessionUser };
          if (data.user) setUser(data.user);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("Failed to load session", err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { user, loading };
}

// 401 时整页跳转登录页；登录/登出后也整页跳转，让 AppNav 重新拉会话。
export function redirectToLogin() {
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

// fetch 包装：接口返回 401（未登录/会话过期）时引导到登录页。
// 注意 /api/auth/me 自身不要用它，否则未登录会无限跳转。
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const target = String(input);
  const queued = ['/api/extract', '/api/generate', '/api/pet/animate'].includes(target) && init?.method === 'POST';
  const headers = new Headers(init?.headers);
  if (queued && !headers.has('Idempotency-Key')) headers.set('Idempotency-Key', crypto.randomUUID());
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) redirectToLogin();
  if (res.status === 202 && queued && target !== '/api/pet/animate') {
    const { taskId } = await res.json();
    const started = Date.now();
    while (Date.now() - started < 15 * 60 * 1000) {
      const signal = init?.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
      const taskResponse = await fetch(`/api/jobs/${encodeURIComponent(taskId)}`, { signal });
      if (taskResponse.status === 401) redirectToLogin();
      if (!taskResponse.ok) throw new Error(`任务查询失败 (${taskResponse.status})；任务 ${taskId} 已保存，请勿重复提交`);
      const { task } = await taskResponse.json();
      if (task.state === 'success') return Response.json(task.result);
      if (['failed', 'needs_review'].includes(task.state)) return Response.json({ error: task.error || task.message }, { status: 502 });
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(`等待超时；任务 ${taskId} 仍已保存，请勿重复提交`);
  }
  return res;
}
