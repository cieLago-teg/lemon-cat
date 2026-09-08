"use client";

import { useEffect, useState } from "react";

// 2026-09-08 1A 用户隔离：前端登录态与 401 引导。
export type SessionUser = {
  id: string;
  email: string;
  credits: number;
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
  const res = await fetch(input, init);
  if (res.status === 401) redirectToLogin();
  return res;
}
