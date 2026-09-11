import type { Metadata } from "next";
import "./globals.css";
import AppNav from "./components/AppNav";
import ErrorBoundary from "./components/ErrorBoundary";
import ClientErrorWatcher from "./components/ClientErrorWatcher";
import { cookies, headers } from 'next/headers';
import { LocaleProvider } from './components/LocaleProvider';
import { LOCALE_COOKIE, resolveLocale, translate } from '@/lib/i18n';

async function requestLocale() {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value, (await headers()).get('accept-language') || '');
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return { title: translate(locale, 'title'), description: translate(locale, 'description'), referrer: 'no-referrer' };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await requestLocale();
  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'} data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Long+Cang&family=Ma+Shan+Zheng&family=M+PLUS+Rounded+1c:wght@300;400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-transparent text-slate-900 font-rounded">
        <LocaleProvider initialLocale={locale}>
        <ErrorBoundary>
          <AppNav />
          {children}
        </ErrorBoundary>
        <ClientErrorWatcher />
        </LocaleProvider>
      </body>
    </html>
  );
}
