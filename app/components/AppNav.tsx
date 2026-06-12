"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function AppNav() {
  const pathname = usePathname() || "/";
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
        </nav>
      </div>
    </header>
  );
}
