import type { Metadata } from "next";
import "./globals.css";
import AppNav from "./components/AppNav";

export const metadata: Metadata = {
  title: "数字宠物档案馆",
  description: "让你的宠物成为永远陪伴你的桌面小伙伴"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Long+Cang&family=Ma+Shan+Zheng&family=M+PLUS+Rounded+1c:wght@300;400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-transparent text-slate-900 font-rounded">
        <AppNav />
        {children}
      </body>
    </html>
  );
}
