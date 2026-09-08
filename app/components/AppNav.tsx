"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/app/components/useSession";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

const items: NavItem[] = [
  {
    href: "/create",
    label: "开始创建",
    match: (p) => p === "/create"
  },
  {
    href: "/pets",
    label: "我的宠物",
    match: (p) => p === "/pets"
  }
];

function nameOf(email: string) {
  const local = email.split("@")[0] || email;
  return local.length > 10 ? `${local.slice(0, 10)}…` : local;
}

export default function AppNav() {
  const pathname = usePathname() || "/";
  const { user, loading } = useSession();

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("logout failed", err);
    }
    // 整页跳转让本组件重新拉取会话。
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-3 z-30 px-4">
      <div className="mx-auto w-fit max-w-[min(92vw,34rem)] rounded-[999px] border border-white/45 bg-white/28 px-5 py-3 shadow-[0_18px_45px_-24px_rgba(92,46,16,0.45),0_6px_18px_rgba(255,255,255,0.22)_inset] ring-1 ring-black/5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/22 sm:px-6 sm:py-3.5">
        <nav className="flex items-center justify-center gap-1.5">
          {items.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-full px-4 py-1.5 font-handwriting font-bold text-base transition-colors duration-200 " +
                  (active
                    ? "bg-white/34 text-amber-950 shadow-[0_2px_10px_rgba(255,255,255,0.18)_inset]"
                    : "text-amber-700/85 hover:bg-white/16 hover:text-amber-900")
                }
              >
                {item.label}
              </Link>
            );
          })}

          {!loading ? (
            <>
              <span className="mx-1 h-4 w-px shrink-0 bg-[#5c2e10]/15" aria-hidden />
              {user ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="max-w-28 truncate font-handwriting text-sm text-amber-800"
                    title={user.email}
                  >
                    {nameOf(user.email)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-full px-2.5 py-1 text-xs font-bold text-amber-700/85 transition-colors hover:bg-white/16 hover:text-amber-900"
                  >
                    退出
                  </button>
                </span>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-white/34 px-4 py-1.5 font-handwriting font-bold text-base text-amber-950 shadow-[0_2px_10px_rgba(255,255,255,0.18)_inset] transition-colors hover:bg-white/45"
                >
                  登录
                </Link>
              )}
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
