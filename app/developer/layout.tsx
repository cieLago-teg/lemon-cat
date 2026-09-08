import { notFound } from "next/navigation";
import { config } from "@/lib/server/config.cjs";

export const dynamic = "force-dynamic";

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const hostname = new URL(config().origin).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) notFound();
  return children;
}
